#!/usr/bin/env nextflow

/*
 * Federated PLINK GWAS meta-analysis on Bacalhau.
 *
 * Each "cohort" is one institution's genotype fileset. The per-cohort GWAS
 * runs inside a Bacalhau container that mounts that cohort's files read-only;
 * only the per-SNP association summary (CHR/SNP/BP/A1/BETA/SE/P, no sample-level
 * genotypes) is written back. A final step combines the per-cohort summaries
 * with PLINK's fixed-effect inverse-variance meta-analysis.
 *
 * This is the federated-GWAS sibling of examples/federated-af. See README.md
 * for what the executor does and does NOT do (notably: no node targeting).
 *
 * Inputs: PLINK text filesets <cohort>.ped / <cohort>.map plus a numeric
 * covariate file <cohort>.cov, one set per cohort under params.data_dir.
 * Generate a synthetic set with generate-plink-data.py (see run.sh).
 */

params.data_dir = "${projectDir}/data"
params.outdir   = 'results'

// PLINK 1.9 from Ubuntu's universe repo. ubuntu:22.04 is multi-arch, so this
// runs on both x86_64 and Apple-Silicon Bacalhau nodes (the plink biocontainer
// is amd64-only and fails on arm64 — see examples/federated-af history).
INSTALL_PLINK = '''
    set -e
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -qq -y --no-install-recommends plink1.9 >/dev/null
'''

process runGWAS {
    tag { name }
    container 'ubuntu:22.04'

    input:
    tuple val(name), path(ped), path(mapf), path(cov)

    output:
    tuple val(name), path("${name}.assoc.logistic"), emit: results
    path "${name}.log",                              emit: logs

    script:
    // The executor mounts each input file read-only at /inputs/<filename> and
    // runs the script from the task workDir. ped/mapf share the cohort basename,
    // so --file points at the /inputs prefix; --out writes into the workDir.
    """
    ${INSTALL_PLINK}

    plink1.9 \\
        --file "/inputs/${name}" \\
        --covar "/inputs/${cov.name}" \\
        --logistic beta hide-covar \\
        --ci 0.95 \\
        --allow-no-sex \\
        --out "${name}"

    # PLINK writes <name>.assoc.logistic on success. Fail loudly (rather than
    # emit an empty/missing file) if the association step produced no results.
    if [ ! -s "${name}.assoc.logistic" ]; then
        echo "ERROR: ${name}.assoc.logistic is missing or empty" >&2
        exit 1
    fi
    """
}

process metaAnalysis {
    container 'ubuntu:22.04'
    publishDir params.outdir, mode: 'copy'

    input:
    path assoc_files, stageAs: 'assoc/*'

    output:
    path 'meta_analysis.meta', emit: meta
    path 'meta_analysis.log',  emit: log
    path 'cohorts.txt',        emit: cohorts

    script:
    // --logistic emitted BETA (log-odds) via the `beta` modifier, so the
    // meta-analysis uses `logscale` to read the BETA column. .assoc.logistic
    // has no A2 column, so A2 is intentionally not mapped.
    """
    ${INSTALL_PLINK}

    ls /inputs/assoc/*.assoc.logistic | sort > cohorts.txt
    echo "Cohorts in meta-analysis:"
    cat cohorts.txt

    plink1.9 \\
        --meta-analysis \$(cat cohorts.txt) + logscale \\
        --meta-analysis-snp-field SNP \\
        --meta-analysis-chr-field CHR \\
        --meta-analysis-bp-field BP \\
        --meta-analysis-a1-field A1 \\
        --meta-analysis-se-field SE \\
        --meta-analysis-p-field P \\
        --out meta_analysis

    if [ ! -s meta_analysis.meta ]; then
        echo "ERROR: meta_analysis.meta is missing or empty" >&2
        exit 1
    fi
    """
}

workflow {
    // One tuple per cohort: (name, .ped, .map, .cov). The .ped/.map/.cov for a
    // cohort must share the same basename in params.data_dir.
    cohorts = Channel
        .fromPath("${params.data_dir}/*.ped", checkIfExists: true)
        .map { ped ->
            def name = ped.baseName
            def mapf = file("${params.data_dir}/${name}.map")
            def cov  = file("${params.data_dir}/${name}.cov")
            if (!mapf.exists()) error "Missing ${name}.map for cohort ${name} in ${params.data_dir}"
            if (!cov.exists())  error "Missing ${name}.cov for cohort ${name} in ${params.data_dir}"
            tuple(name, ped, mapf, cov)
        }

    gwas = runGWAS(cohorts)

    // Combine per-cohort association summaries.
    metaAnalysis(gwas.results.map { _name, assoc -> assoc }.collect())
}

workflow.onComplete {
    println """
    ────────────────────────────────────────────────────────────
    Federated PLINK GWAS meta-analysis ${workflow.success ? 'complete' : 'FAILED'}
    Duration : ${workflow.duration}
    Results  : ${params.outdir}/meta_analysis.meta
    ────────────────────────────────────────────────────────────
    Only per-SNP association statistics (BETA/SE/P) left each task;
    raw genotypes were mounted read-only and never written back.
    ────────────────────────────────────────────────────────────
    """.stripIndent()
}
