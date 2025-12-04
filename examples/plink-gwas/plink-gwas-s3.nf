#!/usr/bin/env nextflow

/*
 * PLINK GWAS Meta-Analysis with S3 Inputs for Bacalhau Executor
 *
 * This workflow demonstrates distributed GWAS analysis with data stored in S3:
 * 1. Each cohort's PLINK files are stored in S3
 * 2. Bacalhau nodes fetch data directly from S3 (no local download needed)
 * 3. Run PLINK logistic regression in parallel
 * 4. Perform meta-analysis on combined results
 */

// Parameters
params.s3_bucket = "s3://my-genomics-data/plink"
params.cohorts = "cohort1,cohort2,cohort3"
params.outdir = "${baseDir}/results"

// Parse cohort list
cohort_list = params.cohorts.tokenize(',')

// Define the GWAS process with S3 inputs
process runGWAS {
    container 'quay.io/biocontainers/plink:1.90b6.21--h779adbc_1'

    cpus 2
    memory '4.GB'
    time '30m'

    input:
    tuple val(cohort_name), val(bed_s3), val(bim_s3), val(fam_s3), val(cov_s3)

    output:
    path "${cohort_name}.assoc.logistic", emit: results
    path "${cohort_name}.log", emit: logs

    script:
    // The S3 paths are passed as strings and Bacalhau will mount them automatically
    """
    # Bacalhau automatically mounts S3 files at /inputs/
    # We need to create the bfile structure that PLINK expects

    # Link files to expected locations
    ln -s /inputs/${cohort_name}.bed ${cohort_name}.bed
    ln -s /inputs/${cohort_name}.bim ${cohort_name}.bim
    ln -s /inputs/${cohort_name}.fam ${cohort_name}.fam

    # Run PLINK logistic regression
    plink --bfile ${cohort_name} \\
          --logistic \\
          --covar /inputs/${cohort_name}.cov \\
          --ci 0.95 \\
          --out ${cohort_name}

    echo "GWAS completed for ${cohort_name} using S3 data"
    echo "Input files:"
    echo "  BED: ${bed_s3}"
    echo "  BIM: ${bim_s3}"
    echo "  FAM: ${fam_s3}"
    echo "  COV: ${cov_s3}"
    """
}

// Define the meta-analysis process
process metaAnalysis {
    container 'quay.io/biocontainers/plink:1.90b6.21--h779adbc_1'

    publishDir params.outdir, mode: 'copy'

    cpus 4
    memory '8.GB'
    time '1h'

    input:
    path results_files

    output:
    path "meta_analysis.*", emit: all_results
    path "meta_analysis.log", emit: meta_log

    script:
    """
    # Create a file list for meta-analysis
    ls *.assoc.logistic > results_list.txt

    # Run PLINK meta-analysis
    plink --meta-analysis results_list.txt \\
          --meta-analysis-snp-field SNP \\
          --meta-analysis-chr-field CHR \\
          --meta-analysis-bp-field BP \\
          --meta-analysis-a1-field A1 \\
          --meta-analysis-a2-field A2 \\
          --meta-analysis-p-field P \\
          --meta-analysis-se-field SE \\
          --out meta_analysis

    echo ""
    echo "Meta-analysis completed successfully!"
    echo "Number of cohorts: \$(wc -l < results_list.txt)"
    echo "Results files:"
    ls -lh meta_analysis.*
    """
}

// Define the workflow
workflow {
    // Create a channel with S3 paths for each cohort
    // In a real scenario, these would come from a sample sheet or parameter file
    cohort_data = Channel.fromList(cohort_list).map { cohort ->
        tuple(
            cohort,
            "${params.s3_bucket}/${cohort}.bed",
            "${params.s3_bucket}/${cohort}.bim",
            "${params.s3_bucket}/${cohort}.fam",
            "${params.s3_bucket}/${cohort}.cov"
        )
    }

    // Run GWAS on each cohort in parallel (each on a different Bacalhau node)
    gwas_results = runGWAS(cohort_data)

    // Collect all results and run meta-analysis
    all_results = gwas_results.results.collect()
    meta_results = metaAnalysis(all_results)

    // Display summary
    meta_results.meta_log.subscribe { log ->
        println ""
        println "=" * 50
        println "PLINK GWAS Meta-Analysis Complete!"
        println "=" * 50
        println "Results directory: ${params.outdir}"
        println "=" * 50
    }
}

workflow.onComplete {
    println """
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Pipeline Execution Summary
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Completed at : ${workflow.complete}
    Duration     : ${workflow.duration}
    Success      : ${workflow.success}
    Exit status  : ${workflow.exitStatus}
    Results dir  : ${params.outdir}
    Cohorts      : ${params.cohorts}
    S3 bucket    : ${params.s3_bucket}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    """
}
