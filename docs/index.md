# Federated Genomics on Bacalhau

**Privacy-preserving, federated genomics on [Bacalhau](https://bacalhau.org):
each site's genotypes stay home; only aggregate statistics cross the network.**

This is the research / federation documentation. The Nextflow executor that
submits work to Bacalhau is a separate project —
[`nf-bacalhau`](https://github.com/shukwong/nf-bacalhau). For now, build it from
a local checkout (set `NF_BACALHAU_REPO`); publishing to the Nextflow Plugin
Registry is planned.

## The idea

The compelling case for *compute-to-data* is federated genomics. Each
institution's genotype matrix is mounted **read-only** into a task that runs next
to it; only per-SNP association statistics (or integer allele counts) are written
back. The example runners assert this privacy invariant automatically.

## Examples

- **[Federated PLINK GWAS](examples/plink-gwas.md)** — a per-cohort GWAS plus
  inverse-variance meta-analysis; genotypes stay on-node, only per-SNP summary
  statistics are pooled.
- **[Federated allele-frequency demo](examples/federated-af.md)** — the privacy
  contract end to end against a local Bacalhau node.

## Running a federation

The [Federation Dashboard guide](federation-dashboard.md) walks through running a
coordinator at each site, registering them in the dashboard, launching runs, and
the end-to-end privacy contract.

!!! warning "Demo security"
    The site coordinator and dashboard are demonstration components — the
    coordinator uses one shared bearer token for read and write, and the
    dashboard stores operator tokens in browser `localStorage`. See the
    project [SECURITY policy](https://github.com/shukwong/nextflow_on_bacalhau/blob/main/SECURITY.md).

## Status

See [Status & Roadmap](status.md). The executor plugin's own roadmap lives in the
[plugin repo](https://github.com/shukwong/nf-bacalhau).
