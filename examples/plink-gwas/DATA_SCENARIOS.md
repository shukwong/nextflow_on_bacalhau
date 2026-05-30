# PLINK GWAS — Where the Data Lives

The same `plink-gwas.nf` workflow runs in three input-sourcing modes, chosen by
how you supply each cohort's path values. This page describes what actually
moves in each mode and the privacy trade-offs — grounded in what the Bacalhau
executor really does, not aspirational claims.

> **Node locality caveat (applies to all modes).** The executor has no
> node-targeting. Bacalhau schedules each cohort's job on an available compute
> node. With `host://` inputs the job can only succeed on a node that already
> holds the path, so data availability — not the scheduler — is what keeps a
> cohort on its own node. See [README.md](README.md#important-limitations).

## Mode 1 — Local files (copied to the node)

Path values are ordinary local files; the executor copies them into the task
and mounts them at `/inputs/`. This is what `run.sh` uses with the synthetic
generator.

| Data | Moves? | Notes |
| --- | --- | --- |
| Genotypes (`.ped`/`.map`) | Uploaded to each job | Whole fileset travels from the launch host to the node |
| Summary stats (`.assoc.logistic`) | Returned | Per-SNP only |

- ✅ Simplest to run; good for testing and small datasets.
- ⚠️ Highest network use — the genotypes are uploaded per job, so this is **not**
  a data-stays-put model. Use it for the demo, not for sensitive data at scale.

## Mode 2 — `host://` (data already on the node)

Path values start with `host:///abs/path`. The executor mounts the node-local
path read-only at `/inputs/`; nothing is uploaded by Nextflow.

| Data | Moves? | Notes |
| --- | --- | --- |
| Genotypes | **No** | Read in place on the node that holds them |
| Summary stats | Returned | Per-SNP only |

- ✅ Closest to the "compute-to-data" / data-sovereignty model: raw genotypes
  stay on the institution's node.
- ⚠️ Requires the data to already exist on whichever node runs the job, and the
  path to be inside that node's `AllowListedLocalPaths`. Because there is no
  node targeting, operate one node per site so a cohort's job can only run where
  its data is.

## Mode 3 — `s3://` (fetched from object storage)

Path values start with `s3://bucket/key`. The executor emits an S3 input source;
Bacalhau fetches the object to the node at job time.

| Data | Moves? | Notes |
| --- | --- | --- |
| Genotypes | S3 → node | Fetched per job; not stored permanently on the node |
| Summary stats | Returned | Per-SNP only |

- ✅ Good for cloud-native workflows where data already lives in S3.
- ⚠️ Credentials are **run-wide**: a single `process.ext.bacalhauSecrets` list
  applies to every S3 input in the run. There is no per-cohort credential
  isolation, so all S3 cohorts share whatever credentials the run provides.

## Choosing a mode

| You want… | Use |
| --- | --- |
| To try the demo end-to-end | Mode 1 (local) — `run.sh` |
| Raw genotypes to stay on each site's node | Mode 2 (`host://`), one node per site |
| Data already in object storage | Mode 3 (`s3://`) |

In every mode the only thing written back from a task is the per-SNP
association summary; the runner's leak check confirms no sample IDs appear in
the outputs.
