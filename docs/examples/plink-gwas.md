# Federated PLINK GWAS Meta-Analysis

A runnable pipeline that runs a per-cohort GWAS (PLINK logistic regression) next
to each cohort's data via the Bacalhau executor, then combines the per-cohort
summaries with a fixed-effect inverse-variance meta-analysis. **The genotype
matrix is mounted read-only into each task; only per-SNP association statistics
(`BETA`, `SE`, `P`) are written back.**

This is the federated-GWAS sibling of the
[allele-frequency demo](federated-af.md): same compute-to-data privacy contract,
but a full association analysis rather than allele counts.

## Privacy model

In human genetics the raw genotype vector is the single most re-identifying
artifact in a dataset — a handful of SNPs uniquely identify an individual even
with no name attached. Federated-GWAS consortia therefore enforce a strict rule:
raw genotypes stay on-site; only per-SNP summary statistics travel.

This pipeline models that rule literally. Each cohort is a separate Bacalhau job,
so cohorts are analysed in parallel and only their summary statistics are pooled.

## What actually leaves each task

| Artifact | Contains genotypes? | Scope |
| --- | --- | --- |
| `<cohort>.ped` / `.map` (input) | Yes — one genotype per sample | mounted read-only at `/inputs/` |
| `<cohort>.assoc.logistic` (output) | **No — one row per SNP** | written back to the workDir |
| `meta_analysis.meta` (final) | **No — one row per SNP** | published to `results/` |

`run.sh` prints a check after the pipeline that asserts no sample IDs appear in
any output file.

## Pipeline

```groovy title="examples/plink-gwas/plink-gwas.nf"
process runGWAS {
    tag { name }
    container 'ubuntu:22.04'

    input:  tuple val(name), path(ped), path(mapf), path(cov)
    output: tuple val(name), path("${name}.assoc.logistic"), emit: results

    script:
    """
    ${INSTALL_PLINK}   // installs PLINK 1.9 from bioconda (x86_64 + arm64)

    plink \\
        --file  "/inputs/${name}" \\
        --covar "/inputs/${cov.name}" \\
        --logistic beta hide-covar \\
        --ci 0.95 --allow-no-sex \\
        --out "${name}"
    """
}

process metaAnalysis {
    container 'ubuntu:22.04'
    publishDir params.outdir, mode: 'copy'

    input:  path assoc_files, stageAs: 'assoc/*'
    output: path 'meta_analysis.meta', emit: meta

    script:
    """
    ${INSTALL_PLINK}

    ls /inputs/assoc/*.assoc.logistic | sort > cohorts.txt
    plink \\
        --meta-analysis \$(cat cohorts.txt) + logscale \\
        --meta-analysis-snp-field SNP --meta-analysis-chr-field CHR \\
        --meta-analysis-bp-field BP   --meta-analysis-a1-field A1 \\
        --meta-analysis-se-field SE \\
        --out meta_analysis
    """
}

workflow {
    cohorts = Channel
        .fromPath("${params.data_dir}/*.ped", checkIfExists: true)
        .map { ped ->
            def name = ped.baseName
            tuple(name, ped, file("${params.data_dir}/${name}.map"),
                          file("${params.data_dir}/${name}.cov"))
        }
    metaAnalysis(runGWAS(cohorts).results.map { _name, assoc -> assoc }.collect())
}
```

`--logistic beta` emits log-odds (`BETA`), so the meta-analysis uses `logscale`
to combine on the log-odds scale; PLINK still reports the pooled effect as an
odds ratio (`OR`/`OR(R)`), not `BETA`.

## Run it

Prerequisites:

- Docker Desktop (running)
- `bacalhau` v1.7.x on PATH
- Nextflow 24.10.x (LTS) on PATH (or `NEXTFLOW_BIN=...`); 25.x+ not yet supported
- Java 17 for the Nextflow runtime (Nextflow 24.10 still runs on JDK 17)
- Python 3
- The [`nf-bacalhau`](https://github.com/shukwong/nf-bacalhau) plugin — build it
  from a local checkout (set `NF_BACALHAU_REPO`), or pre-install the plugin and
  pass `--skip-build`

```bash
# build the plugin from a local checkout and stage it:
NF_BACALHAU_REPO=/path/to/nf-bacalhau ./examples/plink-gwas/run.sh
# ...or, if the plugin is already installed:
./examples/plink-gwas/run.sh --skip-build
```

The driver:

1. Builds the `nf-bacalhau` plugin from `NF_BACALHAU_REPO` and stages it into
   `~/.nextflow/plugins/` (skipped by `--skip-build`, which uses an
   already-installed plugin).
2. Starts a local Bacalhau compute node (if one isn't already on
   `localhost:1234`) with the writable-local-path allowlist the plugin needs.
3. Generates synthetic PLINK filesets for 3 cohorts (no network download).
4. Runs the Nextflow pipeline against them.
5. Prints the meta-analysis output and a summary-statistics leak check.

`--skip-build` and `--skip-bacalhau` speed up re-runs.

## Output

`results/meta_analysis.meta` — the combined per-SNP meta-analysis. PLINK's
`--meta-analysis` columns are:

```
CHR  BP  SNP  A1  A2  N  P  P(R)  OR  OR(R)  Q  I
```

`OR`/`OR(R)` are the fixed- and random-effects odds ratios; `Q`/`I²` report
between-cohort heterogeneity. The run finishes with the privacy check:

```
[ok] No sample-level identifier appears in any output. Federation invariant holds.
```

Every row of `meta_analysis.meta` is derived from per-cohort summary statistics.
No genotype column, no sample ID, and no per-patient row exists in any file that
left a task's workDir.

## Important limitations (read before adapting)

- **No node targeting.** The plugin has no node-selection / affinity support, so
  you cannot pin a cohort to a specific institution's node from the workflow.
  Bacalhau schedules each job on an available node. Real data locality is a
  *deployment* concern: run one Bacalhau compute node per site and restrict it
  (via `host://` paths and the node's `AllowListedLocalPaths`) to that site's
  data. A job that lands on a node lacking the data simply fails to stage it.
- **One S3 credential set per run.** S3 inputs use a single, run-wide credential
  list (`process.ext.bacalhauSecrets`). There is **no** per-cohort credential
  mechanism — do not assume per-institution credential isolation.
- **Not a compliance certification.** "Only summary statistics leave the task" is
  a property you can verify from the outputs (and `run.sh` does). It is not, by
  itself, HIPAA/GDPR certification — that depends on your full deployment, data-use
  agreements, and controls outside this plugin.

## Using your own data

The synthetic generator is only a stand-in. To run against real cohorts, provide
one fileset per cohort (`<cohort>.ped`, `<cohort>.map`, `<cohort>.cov`, sharing a
basename) in `--data_dir`, then:

- **Local / `host://`** — if genotypes already live on the compute node, pass
  them as `host:///abs/path/...` so the executor mounts them read-only without
  copying. The job must run on the node that holds them (see limitations).
- **S3** — pass `s3://bucket/key...` values; the executor fetches them to the
  node. Provide credentials via `process.ext.bacalhauSecrets`.
- **Binary filesets** — real studies use `.bed/.bim/.fam`; switch to that triplet
  and use `--bfile` instead of `--file`. Keep `process.stageInMode = 'copy'` so
  inputs don't dangle inside the container.

`--meta-analysis` is fixed-effect inverse-variance weighting and assumes
**independent, non-overlapping** cohorts. If cohorts may share samples (shared
controls, dual enrolment), de-duplicate or run a relatedness check first; the
emitted `Q`/`I²` flag heterogeneity but do not detect sample overlap.

The full runnable sources and a longer walkthrough live in
[`examples/plink-gwas/README.md`](https://github.com/shukwong/nextflow_on_bacalhau/blob/main/examples/plink-gwas/README.md).

## References

- [PLINK 1.9 association](https://www.cog-genomics.org/plink/1.9/assoc)
- [PLINK 1.9 meta-analysis](https://www.cog-genomics.org/plink/1.9/postproc#meta_analysis)
- [Bacalhau documentation](https://docs.bacalhau.org/)
- [Nextflow documentation](https://www.nextflow.io/docs/latest/)
