# Federated Allele-Frequency Pipeline

A realistic bioinformatics pipeline that demonstrates the privacy guarantee
Bacalhau makes possible: **the genotype matrix never leaves the node that
holds it — only aggregate integer counts travel**.

This is the same compute-to-data pattern used by production federated-genomics
systems (GA4GH Beacon v2, federated-GWAS consortia, hospital-network studies),
where individual patient genotypes are PHI and cannot cross organisational
boundaries.

## Privacy model

In human genetics, the raw genotype vector is the single most re-identifying
artifact in a dataset: a handful of SNPs uniquely identify an individual even
with no name attached. Federated-query frameworks therefore enforce a strict
rule — raw genotypes stay on-site; only aggregates travel.

This pipeline models that rule literally:

1. **Three "sites"** (hospitals / institutions) each hold a shard VCF with
   their own patient cohort. Each shard is mounted into a Bacalhau container
   that runs on the node holding it. The shard file itself never crosses the
   network.
2. A **per-shard process** (`computeSiteCounts`) runs
   `bcftools +fill-tags -t AN,AC` over the genotype matrix and emits a TSV
   with exactly six columns: `CHROM POS REF ALT AC AN`. Genotypes are
   stripped before anything is published out of the task workDir.
3. An **aggregator** (`aggregateCounts`) sums AC and AN across shards to
   produce a pooled allele-frequency table. It never sees a genotype column —
   only integer counts.

## What actually leaves each node

| Artifact                       | Contains genotypes?          | Typical size |
| ------------------------------ | ---------------------------- | ------------ |
| `siteA.vcf` (shard input)      | Yes — 1 column per patient   | ~40 KB       |
| `siteA.counts.tsv` (per-shard) | **No — integer counts only** | ~8 KB        |
| `pooled_af.tsv` (final)        | **No — one row per variant** | ~8 KB        |

The runner prints a privacy-invariant check after the pipeline finishes that
asserts column counts and greps for sample IDs in every output file.

## Pipeline

```groovy title="examples/federated-af/main.nf"
process computeSiteCounts {
    tag       { vcf.baseName }
    container 'ubuntu:22.04'

    input:  path vcf
    output: path "${vcf.baseName}.counts.tsv"

    script:
    """
    apt-get update -qq
    apt-get install -qq -y --no-install-recommends bcftools >/dev/null

    bcftools +fill-tags /inputs/${vcf.name} -Ou -- -t AN,AC \\
      | bcftools query -f '%CHROM\\t%POS\\t%REF\\t%ALT\\t%INFO/AC\\t%INFO/AN\\n' \\
      > ${vcf.baseName}.counts.tsv
    """
}

process aggregateCounts {
    container  'ubuntu:22.04'
    publishDir params.out_dir, mode: 'copy'

    input:  path counts_files, stageAs: 'counts/*'
    output: path 'pooled_af.tsv'

    script:
    '''
    awk 'BEGIN { OFS="\\t"; print "CHROM","POS","REF","ALT","AC","AN","AF" }
         { key=$1 "\\t" $2 "\\t" $3 "\\t" $4
           ac[key] += $5; an[key] += $6 }
         END { for (k in ac) {
                 af = an[k] > 0 ? ac[k]/an[k] : 0
                 printf "%s\\t%s\\t%s\\t%.4f\\n", k, ac[k], an[k], af } }' \\
        /inputs/counts/*.tsv | sort -k1,1 -k2,2n > pooled_af.tsv
    '''
}

workflow {
    shards   = Channel.fromPath("${params.shards_dir}/*.vcf")
    per_site = computeSiteCounts(shards)
    aggregateCounts(per_site.collect())
}
```

## Run it

Prerequisites: Docker Desktop, `bacalhau` v1.7.x, Nextflow 23.10.x on PATH
as `nextflow23` (or `NEXTFLOW_BIN=...`), Java 17, Python 3.

```bash
./examples/federated-af/run.sh
```

The driver:

1. Builds and stages the plugin into `~/.nextflow/plugins/`.
2. Starts a local Bacalhau node (if one isn't already on `:1234`).
3. Generates three deterministic synthetic shards (no network download).
4. Runs the Nextflow pipeline against them.
5. Prints the pooled allele-frequency table and asserts the privacy
   invariant.

`--skip-build` and `--skip-bacalhau` speed up re-runs.

## Sample output

```
CHROM   POS        REF  ALT  AC   AN   AF
chr22   16051012   A    T    1    120  0.0083
chr22   16055579   A    T    18   120  0.1500
chr22   16055896   C    T    41   120  0.3417
chr22   16056049   C    T    11   120  0.0917
...

  shard VCF columns:     29   (9 fixed + 20 samples)
  per-shard counts cols: 6    (expect 6)
  pooled TSV columns:    7    (expect 7)
[ok] No genotype columns or sample IDs left any shard. Federation invariant holds.
```

Every row of `pooled_af.tsv` is derived from summed counts. No genotype
column, no sample ID, and no per-patient row exists in any file that left a
shard's workDir.

## Extending the demo

The shards are synthetic but the pipeline is the real thing. To run against
real data you would:

- Replace `generate-shards.py` with a fetch step that places real VCFs into
  the per-site input directories on each Bacalhau compute node.
- Use `bcftools view -r <region>` inside `computeSiteCounts` to restrict the
  federation to a specific region of interest.
- Add a second summary statistic (Hardy–Weinberg, missingness) to
  `computeSiteCounts` — as long as the output stays aggregate, the federation
  invariant holds.
- Swap the pooled-AF aggregator for a federated meta-analysis step (inverse
  variance weighting over per-site logistic-regression summary stats) to
  turn this into a federated-GWAS skeleton.
