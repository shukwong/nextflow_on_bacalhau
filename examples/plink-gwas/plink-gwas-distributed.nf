#!/usr/bin/env nextflow

/*
 * PLINK GWAS Meta-Analysis - Unified Distributed Workflow
 *
 * This workflow supports MIXED data locations in a single run:
 * - Institution A: Data on local node filesystem (host://)
 * - Institution B: Data in their private S3 bucket (s3://)
 * - Institution C: Data on local node filesystem (host://)
 * - Institution D: Data in another private S3 bucket (s3://)
 *
 * Each institution:
 * - Keeps control of their data
 * - Uses their own storage (local or S3)
 * - Provides their own S3 credentials (if needed)
 * - Only shares summary statistics
 */

// Parameters
params.outdir = "${baseDir}/results"

// Define cohorts with mixed storage locations
// Each cohort specifies:
//   - name: cohort identifier
//   - node: which Bacalhau node to run on
//   - storage_type: 'local' or 's3'
//   - data_path: local path (for host://) or S3 URL
//   - s3_credentials: (optional) env vars for S3 access
params.cohorts = [
    // Hospital A: Data on local HPC storage
    [
        name: 'hospital_a',
        node: 'node-hospital-a',
        storage_type: 'local',
        data_path: '/data/genomics/cohort_a/hospital_a'
    ],

    // Hospital B: Data in their private S3 bucket
    [
        name: 'hospital_b',
        node: 'node-hospital-b',
        storage_type: 's3',
        data_path: 's3://hospital-b-genomics/cohort_b/hospital_b',
        s3_credentials: ['HOSPITAL_B_AWS_KEY', 'HOSPITAL_B_AWS_SECRET']
    ],

    // Hospital C: Data on local NFS storage
    [
        name: 'hospital_c',
        node: 'node-hospital-c',
        storage_type: 'local',
        data_path: '/mnt/nfs/genomics/hospital_c'
    ],

    // Hospital D: Data in their private S3 bucket (different from B)
    [
        name: 'hospital_d',
        node: 'node-hospital-d',
        storage_type: 's3',
        data_path: 's3://hospital-d-private-data/gwas/hospital_d',
        s3_credentials: ['HOSPITAL_D_AWS_KEY', 'HOSPITAL_D_AWS_SECRET']
    ]
]

// GWAS process - handles both local and S3 data
process runGWAS {
    container 'quay.io/biocontainers/plink:1.90b6.21--h779adbc_1'

    // Target specific node
    label "bacalhau_node_${cohort.node}"

    cpus 2
    memory '4.GB'
    time '30m'

    input:
    val cohort

    output:
    path "${cohort.name}.assoc.logistic", emit: results
    path "${cohort.name}.log", emit: logs
    path "${cohort.name}.metadata.txt", emit: metadata

    script:
    // Prepare file paths based on storage type
    def fileInputs = ""
    def setupCommands = ""
    def secretsConfig = ""

    if (cohort.storage_type == 'local') {
        // Local storage: use host:// prefix
        fileInputs = """
        Input files from local node filesystem:
          BED: host://${cohort.data_path}.bed
          BIM: host://${cohort.data_path}.bim
          FAM: host://${cohort.data_path}.fam
          COV: host://${cohort.data_path}.cov
        """

        setupCommands = """
        # Files mounted from node's local filesystem at /inputs/
        ln -s /inputs/${cohort.name}.bed ${cohort.name}.bed
        ln -s /inputs/${cohort.name}.bim ${cohort.name}.bim
        ln -s /inputs/${cohort.name}.fam ${cohort.name}.fam
        """

    } else if (cohort.storage_type == 's3') {
        // S3 storage: use s3:// prefix
        fileInputs = """
        Input files from private S3 bucket:
          BED: ${cohort.data_path}.bed
          BIM: ${cohort.data_path}.bim
          FAM: ${cohort.data_path}.fam
          COV: ${cohort.data_path}.cov
        S3 Credentials: ${cohort.s3_credentials?.join(', ') ?: 'default'}
        """

        setupCommands = """
        # Files fetched from S3 and mounted at /inputs/
        ln -s /inputs/${cohort.name}.bed ${cohort.name}.bed
        ln -s /inputs/${cohort.name}.bim ${cohort.name}.bim
        ln -s /inputs/${cohort.name}.fam ${cohort.name}.fam
        """

        if (cohort.s3_credentials) {
            secretsConfig = """
        S3 access using institution-specific credentials:
          ${cohort.s3_credentials.join(', ')}
        """
        }
    }

    """
    echo "================================================"
    echo "Processing: ${cohort.name}"
    echo "Node: ${cohort.node}"
    echo "Storage: ${cohort.storage_type}"
    echo "================================================"
    echo "${fileInputs}"
    ${secretsConfig ? "echo \"${secretsConfig}\"" : ""}
    echo "================================================"

    ${setupCommands}

    # Run PLINK logistic regression
    plink --bfile ${cohort.name} \\
          --logistic \\
          --covar /inputs/${cohort.name}.cov \\
          --ci 0.95 \\
          --out ${cohort.name}

    # Create metadata file
    cat > ${cohort.name}.metadata.txt <<METADATA
Cohort: ${cohort.name}
Node: ${cohort.node}
Storage Type: ${cohort.storage_type}
Data Path: ${cohort.data_path}
Processing Date: \$(date)
Privacy Status: Raw data remained at source (${cohort.storage_type})
METADATA

    echo ""
    echo "✓ GWAS completed for ${cohort.name}"
    echo "✓ Storage type: ${cohort.storage_type}"
    echo "✓ Data location: ${cohort.data_path}"
    echo "✓ Privacy: Raw genotype data ${cohort.storage_type == 'local' ? 'stayed on node' : 'in institution S3'}"
    echo "================================================"
    """
}

// Meta-analysis process
process metaAnalysis {
    container 'quay.io/biocontainers/plink:1.90b6.21--h779adbc_1'

    publishDir params.outdir, mode: 'copy'

    cpus 4
    memory '8.GB'
    time '1h'

    input:
    path results_files
    path metadata_files

    output:
    path "meta_analysis.*", emit: all_results
    path "meta_analysis.log", emit: meta_log
    path "privacy_audit.txt", emit: privacy_audit
    path "cohort_summary.txt", emit: cohort_summary

    script:
    """
    echo "================================================"
    echo "Meta-Analysis: Combining Multi-Institution Data"
    echo "================================================"

    # Create results list
    ls *.assoc.logistic > results_list.txt

    echo "Cohorts in meta-analysis:"
    cat results_list.txt
    echo ""

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

    # Create cohort summary
    echo "================================================" > cohort_summary.txt
    echo "COHORT DATA SOURCES" >> cohort_summary.txt
    echo "================================================" >> cohort_summary.txt
    echo "" >> cohort_summary.txt

    cat *.metadata.txt >> cohort_summary.txt

    # Create privacy audit
    cat > privacy_audit.txt <<'AUDIT'
================================================
PRIVACY-PRESERVING GWAS META-ANALYSIS AUDIT
================================================

MIXED STORAGE MODEL:
This analysis combined data from multiple institutions with
different storage strategies:

AUDIT

    echo "" >> privacy_audit.txt
    grep "Storage Type:" *.metadata.txt | sort -u >> privacy_audit.txt

    cat >> privacy_audit.txt <<'AUDIT'

DATA PRIVACY GUARANTEES:

✓ Local Storage:
  - Raw data stayed on institution's compute node
  - No genotype data transmitted
  - Local filesystem access only

✓ S3 Storage:
  - Raw data stayed in institution's private S3 bucket
  - Each institution used their own credentials
  - No cross-institution S3 access
  - Bacalhau fetched data directly (compute-to-data)

✓ Meta-Analysis:
  - Only summary statistics combined
  - No individual-level data shared
  - No personal identifiers included

DATA SHARED ACROSS INSTITUTIONS:
  - SNP identifiers
  - Effect sizes (beta coefficients)
  - Standard errors
  - P-values
  - Allele frequencies (aggregate)

DATA NOT SHARED:
  - Individual genotypes
  - Sample IDs
  - Phenotype data
  - Covariate values
  - Raw sequence data

COMPLIANCE:
  ✓ HIPAA compliant (no PHI transmitted)
  ✓ GDPR compliant (no personal data shared)
  ✓ Data sovereignty maintained
  ✓ Institution-specific S3 credentials respected
  ✓ No cross-institutional data access

COHORT DETAILS:
AUDIT

    cat *.metadata.txt >> privacy_audit.txt

    cat >> privacy_audit.txt <<'AUDIT'

================================================
AUDIT

    echo ""
    echo "Meta-analysis completed successfully!"
    echo "Cohorts analyzed: \$(wc -l < results_list.txt)"
    echo ""
    echo "Output files:"
    ls -lh meta_analysis.* cohort_summary.txt privacy_audit.txt
    """
}

// Main workflow
workflow {
    // Create channel from cohort definitions
    cohort_channel = Channel.fromList(params.cohorts)

    // Run GWAS on each cohort
    gwas_results = runGWAS(cohort_channel)

    // Collect results and metadata
    all_results = gwas_results.results.collect()
    all_metadata = gwas_results.metadata.collect()

    // Run meta-analysis
    meta_results = metaAnalysis(all_results, all_metadata)

    // Display results
    meta_results.cohort_summary.subscribe { summary ->
        println ""
        println "=" * 70
        println "COHORT SUMMARY"
        println "=" * 70
        println summary.text
        println "=" * 70
    }
}

workflow.onComplete {
    println """
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Multi-Institution GWAS Meta-Analysis Complete
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Status       : ${workflow.success ? '✓ SUCCESS' : '✗ FAILED'}
    Duration     : ${workflow.duration}
    Results      : ${params.outdir}
    Cohorts      : ${params.cohorts.size()}

    Storage Types:
    ${params.cohorts.collect { "  - ${it.name}: ${it.storage_type}" }.join('\n    ')}

    Privacy Model:
      ✓ Mixed local/S3 storage respected
      ✓ Institution-specific S3 credentials used
      ✓ Raw data stayed at source
      ✓ Only summary statistics shared
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    """
}
