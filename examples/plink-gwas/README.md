# Federated PLINK GWAS Meta-Analysis on Bacalhau

A runnable bioinformatics pipeline that runs a per-cohort GWAS (PLINK logistic
regression) next to each cohort's data via the Bacalhau executor, then combines
the per-cohort summaries with a fixed-effect inverse-variance meta-analysis.

This is the federated-GWAS sibling of [`examples/federated-af`](../federated-af):
the genotype matrix is mounted **read-only** into each task and only per-SNP
association statistics (`BETA`, `SE`, `P`) are written back — individual
genotypes never leave the task.

## What this demo does

1. **Per-cohort GWAS** (`runGWAS`): for each cohort, PLINK runs
   `--logistic beta hide-covar` against that cohort's genotypes and covariates,
   producing a `<cohort>.assoc.logistic` table of per-SNP effect sizes
   (log-odds `BETA`), standard errors, and p-values.
2. **Meta-analysis** (`metaAnalysis`): PLINK's `--meta-analysis ... logscale`
   combines the per-cohort tables into `meta_analysis.meta`.

Each cohort is a separate Bacalhau job, so cohorts are analysed in parallel and
only their summary statistics are pooled.

## What actually leaves each task

| Artifact | Contains genotypes? | Scope |
| --- | --- | --- |
| `<cohort>.ped` / `.map` (input) | Yes — one genotype per sample | mounted read-only at `/inputs/` |
| `<cohort>.assoc.logistic` (output) | **No — one row per SNP** | written back to the workDir |
| `meta_analysis.meta` (final) | **No — one row per SNP** | published to `results/` |

`run.sh` prints a check after the pipeline that asserts no sample IDs appear in
any output file.

## Important limitations (read before adapting)

This example is honest about what the current executor does and does **not** do:

- **No node targeting.** The plugin has no node-selection / affinity support, so
  you cannot pin a cohort to a specific institution's node from the workflow.
  Bacalhau schedules each job on an available node. Real data locality is a
  *deployment* concern: run one Bacalhau compute node per site and restrict it
  (via `host://` paths and the node's `AllowListedLocalPaths`) to that site's
  data. A job that lands on a node lacking the data simply fails to stage it.
- **One S3 credential set per run.** S3 inputs use a single, run-wide credential
  list (`process.ext.bacalhauSecrets`). There is **no** per-cohort credential
  mechanism. Do not assume per-institution credential isolation.
- **Not a compliance certification.** "Only summary statistics leave the task"
  is a property you can verify from the outputs (and `run.sh` does). It is not,
  by itself, HIPAA/GDPR certification — that depends on your full deployment,
  data-use agreements, and controls outside this plugin.

## Prerequisites

- Docker Desktop (running)
- `bacalhau` v1.7.x on PATH
- Nextflow 24.10.0 or later (set `NEXTFLOW_BIN` to point at your binary)
- Java 17 for the Nextflow runtime (Nextflow 24.10 still runs on JDK 17)
- Python 3

## Run it

```bash
./examples/plink-gwas/run.sh
```

The runner will:

1. Build and stage the `nf-bacalhau` plugin into `~/.nextflow/plugins/`.
2. Start a local Bacalhau compute node (if one isn't already on
   `localhost:1234`) with the writable-local-path allowlist the plugin needs.
3. Generate synthetic PLINK filesets for 3 cohorts (no network download).
4. Run the Nextflow pipeline against them.
5. Print the meta-analysis output and a summary-statistics leak check.

`--skip-build` and `--skip-bacalhau` are available for faster re-runs.

## Output

`results/meta_analysis.meta` — combined per-SNP meta-analysis. PLINK's
`--meta-analysis` columns include `CHR SNP BP A1 A2 N P P(R) BETA BETA(R) Q I`
(fixed- and random-effects estimates plus heterogeneity `Q`/`I²`).

## Using your own data

The synthetic generator is only a stand-in. To run against real cohorts,
provide one fileset per cohort in `--data_dir` (`<cohort>.ped`, `<cohort>.map`,
`<cohort>.cov`, sharing a basename), then:

- **Local / `host://`** — if the genotypes already live on the compute node,
  pass them as `host:///abs/path/...` path values so the executor mounts them
  read-only without copying. The job must run on the node that holds them (see
  limitations above).
- **S3** — pass `s3://bucket/key...` path values; the executor fetches them to
  the node. Provide credentials via `process.ext.bacalhauSecrets`.
- **Binary filesets** — real studies use `.bed/.bim/.fam`; switch the inputs to
  that triplet and use `--bfile` instead of `--file`. Keep
  `process.stageInMode = 'copy'` so inputs don't dangle inside the container.

### Notes on the PLINK steps

- `--logistic beta` emits log-odds (`BETA`), so the meta-analysis uses
  `logscale` to read the `BETA` column. (Drop `beta` and `logscale` together if
  you prefer the odds-ratio scale.)
- `--logistic` reads the case/control phenotype from the `.ped` 6th column.
  Ensure both cases (`2`) and controls (`1`) are present.
- `--meta-analysis` is fixed-effect inverse-variance weighting and assumes
  **independent, non-overlapping** cohorts. If cohorts may share samples
  (shared controls, dual enrolment), de-duplicate or run a relatedness check
  first; the emitted `Q`/`I²` flag heterogeneity but do not detect sample overlap.

## References

- [PLINK 1.9 association](https://www.cog-genomics.org/plink/1.9/assoc)
- [PLINK 1.9 meta-analysis](https://www.cog-genomics.org/plink/1.9/postproc#meta_analysis)
- [Bacalhau documentation](https://docs.bacalhau.org/)
- [Nextflow documentation](https://www.nextflow.io/docs/latest/)
