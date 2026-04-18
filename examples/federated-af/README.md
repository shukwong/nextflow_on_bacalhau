# Federated Allele-Frequency Demo

A realistic bioinformatics pipeline that showcases the privacy guarantee the
Bacalhau executor makes possible: **the genotype matrix never has to leave
the node that holds it — only aggregate integer counts travel.**

This is the same pattern used by production federated-genomics systems
(GA4GH Beacon v2, federated-GWAS consortia, hospital-network studies) where
individual patient genotypes are PHI and cannot cross organisational boundaries.

## Why this pipeline demonstrates privacy

In human genetics the raw genotype vector is the single most re-identifying
artifact you can store: a handful of SNPs uniquely identify an individual even
with no name attached. Federated-query frameworks therefore enforce a strict
rule — raw genotypes stay on-site; only aggregate counts move.

This pipeline models that rule literally:

1. **Three "sites"** (hospitals / institutions) each hold a shard VCF with
   their own patient cohort. Each shard is mounted into a Bacalhau container
   that runs on the node holding it. The shard file itself never crosses the
   network.
2. The **per-shard process** (`computeSiteCounts`) runs `bcftools +fill-tags`
   to compute AC/AN from the genotype matrix, then `bcftools query` to emit a
   TSV with exactly 6 columns: `CHROM POS REF ALT AC AN`. Individual
   genotypes are stripped before anything is published out of the task workDir.
3. The **aggregator** (`aggregateCounts`) sums AC and AN per site across
   shards to produce a pooled allele frequency table. It never sees a
   genotype column — only integer counts.

## What actually leaves each node

| Artifact                         | Contains genotypes?           | Typical size |
| -------------------------------- | ----------------------------- | ------------ |
| `siteA.vcf` (shard input)        | Yes — 1 column per patient    | ~40 KB       |
| `siteA.counts.tsv` (per-shard)   | **No — integer counts only**  | ~8 KB        |
| `pooled_af.tsv` (final)          | **No — one row per variant**  | ~8 KB        |

The runner prints a privacy-invariant check after the pipeline finishes that
asserts the column counts and greps for sample IDs in every output file.

## Run it

Prerequisites:

- Docker Desktop (running)
- `bacalhau` v1.7.x on PATH
- Nextflow 24.10.0 or later (set `NEXTFLOW_BIN` to point to your binary)
- Java 17 for Nextflow runtime (Nextflow 24.10 still runs on JDK 17)
- Python 3

```bash
./examples/federated-af/run.sh
```

The runner will:

1. Build and stage the `nf-bacalhau` plugin snapshot into
   `~/.nextflow/plugins/`.
2. Start a local Bacalhau compute node (if one isn't already on
   `localhost:1234`) with the writable-local-path allowlist needed by the
   plugin.
3. Generate three deterministic synthetic shards (no network download).
4. Run the Nextflow pipeline against them.
5. Print the pooled allele-frequency table and a privacy-invariant check.

`--skip-build` and `--skip-bacalhau` are available for faster re-runs.

## Output

```
CHROM   POS        REF  ALT  AC   AN   AF
chr22   16051412   A    G    4    120  0.0333
chr22   16053214   T    C    38   120  0.3167
chr22   16055819   G    A    2    120  0.0167
...
```

Every row is derived from summed counts. No genotype column, no sample ID,
no per-patient row exists in any file that left a shard's workDir.

## Extending the demo

The shards are synthetic but the pipeline is the real thing. To run against
real data you would:

- Replace `generate-shards.py` with a fetch step that places real VCFs into
  the per-site input directories on each Bacalhau compute node.
- Use `bcftools view -r <region>` inside `computeSiteCounts` if you want to
  restrict the federation to a specific region of interest.
- Add a second summary stat (e.g. Hardy–Weinberg, missingness) to
  `computeSiteCounts` — as long as the output stays aggregate, the
  federation invariant holds.
- Swap the pooled-AF aggregator for a federated meta-analysis step (inverse
  variance weighting over per-site logistic-regression summary stats) to
  turn this into a federated-GWAS skeleton.
