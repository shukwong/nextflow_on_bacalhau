#!/usr/bin/env nextflow

/*
 * Federated allele-frequency pipeline (Beacon v2 / federated-GWAS pattern).
 *
 * Each input shard is a VCF containing one institution's patient cohort.
 * The per-shard process runs next to the shard (via the Bacalhau executor)
 * and emits only aggregate allele counts — never individual genotypes.
 * A final aggregator sums the counts across shards to compute pooled AF.
 *
 * The privacy invariant: the genotype matrix never leaves the node that
 * holds the shard. Only integer counts travel.
 */

params.shards_dir = '/tmp/federated-af/shards'
params.out_dir    = '/tmp/federated-af/out'

process computeSiteCounts {
    tag { vcf.baseName }
    container 'ubuntu:22.04'

    input:
    path vcf

    output:
    path "${vcf.baseName}.counts.tsv"

    script:
    """
    set -e
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -qq -y --no-install-recommends bcftools >/dev/null

    # The Bacalhau executor mounts each Nextflow input file read-only at
    # /inputs/<name>. The shard genotype matrix is read from there; only the
    # aggregate counts (6 columns, no GT) are written back to the workDir.
    bcftools +fill-tags /inputs/${vcf.name} -Ou -- -t AN,AC \\
      | bcftools query -f '%CHROM\\t%POS\\t%REF\\t%ALT\\t%INFO/AC\\t%INFO/AN\\n' \\
      > ${vcf.baseName}.counts.tsv
    """
}

process aggregateCounts {
    container 'ubuntu:22.04'
    publishDir params.out_dir, mode: 'copy'

    input:
    path counts_files, stageAs: 'counts/*'

    output:
    path 'pooled_af.tsv'

    script:
    '''
    awk 'BEGIN { OFS="\\t"; print "CHROM","POS","REF","ALT","AC","AN","AF" }
         {
           key = $1 "\\t" $2 "\\t" $3 "\\t" $4
           ac[key] += $5
           an[key] += $6
         }
         END {
           for (k in ac) {
             af = an[k] > 0 ? ac[k] / an[k] : 0
             printf "%s\\t%s\\t%s\\t%.4f\\n", k, ac[k], an[k], af
           }
         }' /inputs/counts/*.tsv \\
      | sort -k1,1 -k2,2n > pooled_af.tsv
    '''
}

workflow {
    shards   = Channel.fromPath("${params.shards_dir}/*.vcf")
    per_site = computeSiteCounts(shards)
    aggregateCounts(per_site.collect())
}
