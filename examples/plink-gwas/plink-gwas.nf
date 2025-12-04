#!/usr/bin/env nextflow

/*
 * PLINK GWAS Meta-Analysis Example for Bacalhau Executor
 *
 * This workflow demonstrates distributed GWAS analysis:
 * 1. Run PLINK logistic regression on multiple datasets in parallel (each on a different Bacalhau node)
 * 2. Perform meta-analysis on the combined results
 */

// Parameters
params.data_dir = "${baseDir}/data/plink"
params.cohorts = "cohort1,cohort2,cohort3"  // Comma-separated list of cohort names
params.outdir = "${baseDir}/results"

// Parse cohort list
cohort_list = params.cohorts.tokenize(',')

// Define the GWAS process - runs on each cohort in parallel
process runGWAS {
    container 'quay.io/biocontainers/plink:1.90b6.21--h779adbc_1'

    cpus 2
    memory '4.GB'
    time '30m'

    input:
    val cohort_name

    output:
    path "${cohort_name}.assoc.logistic", emit: results
    path "${cohort_name}.log", emit: logs

    script:
    """
    # Note: Input files should be available on the remote node or via S3
    # For this example, we assume files are mounted at /inputs/
    # Files expected: ${cohort_name}.bed, ${cohort_name}.bim, ${cohort_name}.fam, ${cohort_name}.cov

    plink --bfile /inputs/${cohort_name} \\
          --logistic \\
          --covar /inputs/${cohort_name}.cov \\
          --ci 0.95 \\
          --out ${cohort_name}

    echo "GWAS completed for ${cohort_name}"
    """
}

// Define the meta-analysis process - runs after all GWAS jobs complete
process metaAnalysis {
    container 'quay.io/biocontainers/plink:1.90b6.21--h779adbc_1'

    publishDir params.outdir, mode: 'copy'

    cpus 4
    memory '8.GB'
    time '1h'

    input:
    path results_files  // All GWAS results collected

    output:
    path "meta_analysis.results", emit: meta_results
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

    echo "Meta-analysis completed"
    echo "Number of cohorts analyzed: \$(wc -l < results_list.txt)"
    """
}

// Define the workflow
workflow {
    // Create a channel from cohort names
    cohort_channel = Channel.fromList(cohort_list)

    // Run GWAS on each cohort in parallel (distributed across Bacalhau nodes)
    gwas_results = runGWAS(cohort_channel)

    // Collect all results and run meta-analysis
    all_results = gwas_results.results.collect()
    meta_results = metaAnalysis(all_results)

    // Display summary
    meta_results.meta_log.view { log ->
        println "==================================="
        println "Meta-Analysis Complete!"
        println "Results saved to: ${params.outdir}"
        println "==================================="
    }
}

workflow.onComplete {
    println """
    Pipeline execution summary
    ---------------------------
    Completed at: ${workflow.complete}
    Duration    : ${workflow.duration}
    Success     : ${workflow.success}
    Results dir : ${params.outdir}
    """
}
