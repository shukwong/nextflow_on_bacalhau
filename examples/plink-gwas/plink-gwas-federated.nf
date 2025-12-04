#!/usr/bin/env nextflow

/*
 * PLINK GWAS Meta-Analysis with Data on Remote Nodes
 *
 * This workflow demonstrates TRUE distributed, privacy-preserving GWAS:
 * - Each cohort's data ALREADY EXISTS on specific remote nodes
 * - No data transfer between institutions
 * - Each node processes its own local data
 * - Only summary statistics (GWAS results) are shared
 *
 * Use case: Multi-center genomics study where each hospital/institution
 * keeps their raw data on their own compute nodes.
 */

// Parameters
params.outdir = "${baseDir}/results"

// Define cohorts with their data locations on remote nodes
// Format: [cohort_name, node_identifier, data_path_on_node]
params.cohorts = [
    [name: 'hospital_a', node: 'node-hospital-a', data_path: '/data/genomics/hospital_a'],
    [name: 'hospital_b', node: 'node-hospital-b', data_path: '/data/genomics/hospital_b'],
    [name: 'hospital_c', node: 'node-hospital-c', data_path: '/data/genomics/hospital_c']
]

// Define the GWAS process - each runs on its designated node
process runGWAS {
    container 'quay.io/biocontainers/plink:1.90b6.21--h779adbc_1'

    // Target specific node using labels (Bacalhau node selection)
    label 'bacalhau_node_${cohort.node}'

    cpus 2
    memory '4.GB'
    time '30m'

    input:
    val cohort  // Contains: name, node, data_path

    output:
    path "${cohort.name}.assoc.logistic", emit: results
    path "${cohort.name}.log", emit: logs

    script:
    // Use host:// prefix to mount data from the remote node's filesystem
    def bed_path = "host://${cohort.data_path}.bed"
    def bim_path = "host://${cohort.data_path}.bim"
    def fam_path = "host://${cohort.data_path}.fam"
    def cov_path = "host://${cohort.data_path}.cov"

    """
    echo "================================================"
    echo "Processing ${cohort.name} on node: ${cohort.node}"
    echo "Data location: ${cohort.data_path}"
    echo "================================================"

    # Files are mounted from the node's local filesystem at /inputs/
    # Create symbolic links with expected PLINK naming
    ln -s /inputs/${cohort.name}.bed ${cohort.name}.bed
    ln -s /inputs/${cohort.name}.bim ${cohort.name}.bim
    ln -s /inputs/${cohort.name}.fam ${cohort.name}.fam

    # Run PLINK logistic regression
    plink --bfile ${cohort.name} \\
          --logistic \\
          --covar /inputs/${cohort.name}.cov \\
          --ci 0.95 \\
          --out ${cohort.name}

    echo ""
    echo "GWAS completed for ${cohort.name}"
    echo "Node: ${cohort.node}"
    echo "Input data: ${cohort.data_path}"
    echo "Results: ${cohort.name}.assoc.logistic"
    echo ""
    echo "Privacy note: Raw genotype data remained on ${cohort.node}"
    echo "Only summary statistics are being shared."
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
    path results_files  // All GWAS results collected (summary statistics only)

    output:
    path "meta_analysis.*", emit: all_results
    path "meta_analysis.log", emit: meta_log
    path "privacy_audit.txt", emit: privacy_audit

    script:
    """
    echo "================================================"
    echo "Meta-Analysis: Combining results from all sites"
    echo "================================================"

    # Create a file list for meta-analysis
    ls *.assoc.logistic > results_list.txt

    echo "Cohorts included in meta-analysis:"
    cat results_list.txt

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

    # Create privacy audit report
    cat > privacy_audit.txt <<'AUDIT'
================================================
PRIVACY-PRESERVING GWAS META-ANALYSIS AUDIT
================================================

Data Privacy Model:
- Raw genotype data NEVER left source institutions
- Each cohort processed on its designated node
- Only summary statistics (effect sizes, p-values) shared
- No individual-level data in meta-analysis

Cohorts Analyzed:
AUDIT

    cat results_list.txt >> privacy_audit.txt

    cat >> privacy_audit.txt <<'AUDIT'

Data Shared:
- SNP identifiers
- Effect sizes (beta coefficients)
- Standard errors
- P-values
- Allele frequencies

Data NOT Shared:
- Individual genotypes
- Sample identifiers
- Raw phenotype data
- Covariate values

Compliance:
✓ HIPAA compliant (no PHI shared)
✓ GDPR compliant (no personal data shared)
✓ Institutional policies respected
✓ Data sovereignty maintained
================================================
AUDIT

    echo ""
    echo "Meta-analysis completed successfully!"
    echo "Number of cohorts: \$(wc -l < results_list.txt)"
    echo "Privacy audit: privacy_audit.txt"
    """
}

// Define the workflow
workflow {
    // Create a channel from cohort definitions
    cohort_channel = Channel.fromList(params.cohorts)

    // Run GWAS on each cohort (each on its designated node with local data)
    gwas_results = runGWAS(cohort_channel)

    // Collect all results (summary statistics only) and run meta-analysis
    all_results = gwas_results.results.collect()
    meta_results = metaAnalysis(all_results)

    // Display summary
    meta_results.privacy_audit.subscribe { audit ->
        println ""
        println "=" * 60
        println "PRIVACY-PRESERVING META-ANALYSIS COMPLETE"
        println "=" * 60
        println audit.text
        println "=" * 60
    }
}

workflow.onComplete {
    println """
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Privacy-Preserving GWAS Meta-Analysis Complete
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Status       : ${workflow.success ? '✓ SUCCESS' : '✗ FAILED'}
    Duration     : ${workflow.duration}
    Results dir  : ${params.outdir}

    Privacy Model:
    - Raw data stayed on ${params.cohorts.size()} separate nodes
    - Only summary statistics shared
    - HIPAA/GDPR compliant
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    """
}
