---
title: "nf-bacalhau: A Nextflow executor for privacy-preserving federated bioinformatics on the Bacalhau compute network"
author:
  - name: Wendy Wong
    affiliation: 1
    orcid: 0000-0000-0000-0000
    corresponding: true
    email: wendy.wong@example.org
affiliations:
  - id: 1
    name: TBD
date: 2026-04-17
keywords:
  - Nextflow
  - Bacalhau
  - federated genomics
  - compute-to-data
  - workflow management
bibliography: refs.bib
csl: bioinformatics.csl
geometry: margin=2.5cm
fontsize: 11pt
---

## Abstract

**Motivation.** Bioinformatics workflows increasingly process data that cannot
be centralised: institutional genotype archives covered by data-protection
regulation, object-storage datasets too large to move, and edge-generated
sensor data with prohibitive egress costs. Nextflow is the de-facto workflow
engine for reproducible bioinformatics but its stock executors (Slurm, AWS
Batch, Kubernetes) assume a single administrative domain where data can be
co-located with compute. Bacalhau is a container orchestrator designed for
the inverse case — *move the compute to the data* — but has no native
interface to Nextflow pipelines.

**Results.** We present **nf-bacalhau**, a Nextflow executor plugin that
dispatches any Nextflow process to a Bacalhau compute network. Nextflow
resource directives, input channels, and container specifications are
translated into Bacalhau job YAML without pipeline changes. We demonstrate
the plugin with a federated allele-frequency pipeline modelled on the
GA4GH Beacon v2 / federated-GWAS pattern, in which per-institution genotype
matrices never leave their host node; only integer allele counts are
aggregated. A privacy invariant built into the pipeline runner verifies
that no genotype column or sample identifier appears in any output that
crossed a node boundary.

**Availability and implementation.** nf-bacalhau is implemented in Groovy,
distributed under the Apache 2.0 licence, and available at
<https://github.com/shukwong/nextflow_on_bacalhau>. Documentation and a
worked federated-genomics example are hosted at
<https://shukwong.github.io/nextflow_on_bacalhau/>.

**Contact.** wendy.wong@example.org

---

## 1 Introduction

Genomics, epidemiology, and clinical-research studies are routinely
constrained by the physical location of their input data. Patient-derived
sequence data is governed by regulations (GDPR, HIPAA, national genomic
sovereignty frameworks) that prohibit or restrict cross-border movement of
individual-level records [@Thorogood2018; @Dyke2018]. Distributed sensor
networks and cross-cloud reference datasets impose analogous constraints for
different reasons: bandwidth, egress cost, or latency. The dominant workflow
engines in bioinformatics — Nextflow [@DiTommaso2017], Snakemake
[@Molder2021], and WDL [@VossW2017] — all assume that their executor can
stage inputs to a compute pool the user fully controls.

A complementary approach is **compute-to-data** orchestration, in which a
scheduler dispatches a container description to the node already holding
the data and returns only the outputs [@Expanso2023]. Bacalhau is a
production implementation of this model: it accepts a declarative job spec
(container image, resource requirements, input/output sources), selects a
compute node that advertises the relevant data, and mounts the data into
the container at job time. For federated genomics it allows per-institution
genotype data to remain on-site while a shared analytic workflow produces
exportable summary statistics.

Bacalhau is, however, *workflow-unaware*: each job is a single container
invocation. Expressing a multi-stage bioinformatics pipeline as a network
of Bacalhau jobs requires external glue code that duplicates functionality
Nextflow already provides — dependency resolution, resumable execution,
work-directory management, result staging, and channel-based dataflow.

This applications note presents **nf-bacalhau**, an executor plugin that
bridges the two systems. Nextflow pipelines run unchanged; the plugin
translates each process invocation into a Bacalhau job and threads the
result back through Nextflow's polling monitor.

## 2 Implementation

### 2.1 Plugin architecture

nf-bacalhau is a Nextflow plugin (JAR + `extensions.idx`) that registers a
custom executor named `bacalhau`. The executor extends
`AbstractGridExecutor`, Nextflow's abstraction over batch-style schedulers
(Slurm, SGE, LSF, PBS). Inheriting from this base class allows the plugin
to reuse Nextflow's polling monitor, retry semantics, work-directory
management, and staging lifecycle unchanged. The plugin-specific
responsibilities are:

1. Translating Nextflow process directives into a Bacalhau job YAML
   descriptor at submission time.
2. Driving the Bacalhau CLI (`bacalhau job run`, `bacalhau job list`,
   `bacalhau job get`) to submit, poll, and retrieve jobs.
3. Mapping Bacalhau job states (`Pending`, `Running`, `Completed`,
   `Failed`, …) onto Nextflow's `QueueStatus` enumeration.

Configuration is accepted under either a dedicated `bacalhau { }` scope or
`process.ext.*`, with the dedicated scope taking precedence. Options cover
the CLI path, API endpoint, retry policy, storage backend (`ipfs`, `s3`,
`local`), and an allow-list of environment-variable names to forward to the
compute container (`ext.bacalhauSecrets`).

### 2.2 Job translation

Each Nextflow task is translated into a Bacalhau job spec whose key fields
are:

- `Engine.Params.Image`: the `container` directive.
- `InputSources`: one entry per Nextflow `path` input. Local workDir-staged
  files become `localDirectory` mounts at `/inputs/<name>` (read-only);
  `s3://` URIs become native S3 sources; `host://` URIs become read-write
  `localDirectory` mounts for large on-node reference datasets.
- `Resources`: `cpus`, `memory`, `disk`, and `accelerator` directives map
  to `Resources.{CPU,Memory,Disk,GPU}`.
- `Timeouts.ExecutionTimeout`: the `time` directive.
- `Engine.Params.EnvironmentVariables`: values of environment variables
  listed in `ext.bacalhauSecrets`, resolved from the Nextflow driver shell
  at submit time (names, not values, are captured in the config).

The task's Nextflow workDir is mounted read-write at `/nextflow-scripts`
inside the container, and the entrypoint is wrapped as

```
cd /nextflow-scripts && bash .command.sh > .command.out 2> .command.err;
echo $? > .exitcode
```

so that Nextflow's standard contract (exit code, captured stdout/stderr,
named outputs in the workDir) is preserved without requiring changes to
user pipelines.

### 2.3 Polling and queue status

Bacalhau exposes job status via `bacalhau job list --output json`. Two
properties of this interface complicate straightforward parsing:

- The CLI paginates results (default limit: 10) and appends a plain-text
  pagination hint after the JSON array when more records exist.
- Long-running workflows submit far more jobs than fit on one page, so a
  Nextflow polling cycle that reads only the first page can miss state
  transitions for in-flight jobs.

nf-bacalhau addresses both: it passes `--limit 1000` on every call and
extracts the balanced JSON array via a small scanner before parsing. The
resulting status map is cached with a five-second TTL and a ten-second
failure-backoff, so the `TaskPollingMonitor` reuses one CLI fetch across
concurrent tasks and does not spin on a broken endpoint.

## 3 Application: a privacy-preserving federated allele-frequency pipeline

To illustrate the privacy guarantee Bacalhau makes possible, we include a
reference pipeline that computes pooled allele frequencies across three
simulated institutional cohorts without ever moving the per-patient
genotype matrix (`examples/federated-af/`).

Each of three "sites" holds a shard VCF with 20 samples × 200 variants on
chromosome 22. Because the genotype vector of even a small SNP panel is a
known re-identification vector [@Homer2008; @Sweeney2013], federated
genomics protocols require that raw genotypes never leave the custodian
node [@Thorogood2018]. The pipeline enforces this rule structurally:

1. **`computeSiteCounts`** — a Bacalhau job scheduled on the node holding
   the shard. It runs `bcftools +fill-tags -t AN,AC` on the genotype
   matrix and emits a six-column TSV (`CHROM POS REF ALT AC AN`). Only
   this aggregate file is published back to the task workDir.
2. **`aggregateCounts`** — sums allele counts and totals across shards to
   produce a pooled allele-frequency table (`CHROM POS REF ALT AC AN AF`).
   It never sees a genotype column.

A runner script (`run.sh`) generates deterministic synthetic shards,
starts a local Bacalhau compute node, executes the pipeline, and asserts
the federation invariant: per-shard TSVs must be exactly six columns, the
pooled TSV seven columns, and no sample identifier of the form `site[A-Z]_P[0-9]+`
may appear in any file that left a shard's workDir. A reference execution
on a single-node local Bacalhau cluster completes four jobs (3 × compute,
1 × aggregate) in approximately two minutes on consumer hardware and
produces a 201-row pooled AF table. The invariant check is wired directly
into the runner so any regression that leaked genotype data would fail CI.

This pattern generalises beyond pooled AF. Replacing the aggregator with
inverse-variance weighting over per-site logistic-regression summary
statistics yields a federated GWAS skeleton of the kind used in real
consortia [@Lloret-Villas2021]. Adding `bcftools view -r <region>` to the
per-site process restricts the federation to a pre-agreed region of
interest. As long as per-site outputs remain aggregate, the invariant
holds.

## 4 Availability and Requirements

**Project name.** nf-bacalhau

**Project home page.** <https://github.com/shukwong/nextflow_on_bacalhau>

**Operating systems.** Linux, macOS (tested on Apple Silicon and x86_64).

**Programming language.** Groovy (plugin), Python (example data generator),
Nextflow DSL2 (example pipeline).

**Other requirements.** Nextflow ≥ 23.10.1; Bacalhau CLI 1.7.x; Java 17
for building; Docker for local compute-node testing.

**Licence.** Apache Licence 2.0.

**Any restrictions to use by non-academics.** None.

## 5 Discussion

nf-bacalhau fills a gap between Nextflow's pipeline abstractions and
Bacalhau's compute-to-data orchestration. Reusing
`AbstractGridExecutor` keeps the plugin small (~1000 LOC) and
forward-compatible with Nextflow's established batch-executor surface.
The federated allele-frequency pipeline is a deliberately minimal
illustration — the pattern (per-site reduction to aggregates, central
pooling of aggregates) is the backbone of production federated-GWAS
consortia and can be extended in-place.

Current limitations are: (i) the plugin targets Nextflow 23.10.x (a 25.x
port is planned); (ii) job state is polled rather than event-driven, which
caps responsiveness at the five-second cache TTL; and (iii) the executor
shells out to the Bacalhau CLI rather than a native Java client. Planned
work focuses on multi-node benchmarking against Slurm and AWS Batch for
representative genomics workloads, event-driven state subscription when
Bacalhau exposes a suitable interface, and publication of the plugin to
the Nextflow plugin registry.

## Acknowledgements

We thank the Nextflow plugin team for documenting the executor SPI, and
the Bacalhau project for maintaining a stable CLI contract across minor
releases.

## Funding

TBD.

## References
