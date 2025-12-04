# PLINK GWAS Meta-Analysis on Bacalhau

This example demonstrates distributed Genome-Wide Association Study (GWAS) analysis using PLINK on Bacalhau's distributed compute network.

## Overview

The workflow performs:
1. **Parallel GWAS Analysis**: Runs PLINK logistic regression on multiple cohorts/datasets simultaneously, each on a different Bacalhau compute node
2. **Meta-Analysis**: Combines results from all cohorts using PLINK meta-analysis

This approach is ideal for:
- Multi-center studies with separate cohorts
- Chromosome-wise analysis (run GWAS per chromosome in parallel)
- Privacy-preserving analysis (data stays at source, only summary statistics shared)

## ⭐ Unified Distributed Workflow (NEW!)

**File**: `plink-gwas-distributed.nf` **← RECOMMENDED**

The **most flexible** approach - handles **MIXED storage** in ONE workflow:

```groovy
params.cohorts = [
    // Hospital A: Local storage
    [name: 'hospital_a', storage_type: 'local',
     data_path: '/data/genomics/cohort_a'],

    // Hospital B: Their private S3 with their credentials
    [name: 'hospital_b', storage_type: 's3',
     data_path: 's3://hospital-b-genomics/cohort',
     s3_credentials: ['HOSPITAL_B_AWS_KEY', 'HOSPITAL_B_AWS_SECRET']],

    // Hospital C: Local storage
    [name: 'hospital_c', storage_type: 'local',
     data_path: '/mnt/nfs/genomics/cohort_c'],

    // Hospital D: Different private S3 with their credentials
    [name: 'hospital_d', storage_type: 's3',
     data_path: 's3://hospital-d-data/gwas',
     s3_credentials: ['HOSPITAL_D_AWS_KEY', 'HOSPITAL_D_AWS_SECRET']]
]
```

✅ **ONE workflow, multiple storage types**
✅ **Each institution keeps their own storage**
✅ **Per-institution S3 credentials (no sharing)**
✅ **Maximum privacy and flexibility**
✅ **Real-world multi-institution model**

## Other Workflow Variants

### `plink-gwas-federated.nf`
Local storage only (all cohorts on their nodes)

### `plink-gwas-s3.nf`
S3 storage only (all cohorts in one/shared S3)

### `plink-gwas.nf`
Development/testing (data staged from local machine)

## Files

- `plink-gwas-distributed.nf` - ⭐ **RECOMMENDED** (mixed local + S3)
- `plink-gwas-federated.nf` - Local storage only
- `plink-gwas-s3.nf` - S3 storage only
- `plink-gwas.nf` - Basic (testing)
- `plink-gwas.config` - Configuration
- `DATA_SCENARIOS.md` - Detailed guide

## Prerequisites

### 1. PLINK Data Files

For each cohort, you need:
- **`.bed`** - Binary genotype file
- **`.bim`** - Variant information file
- **`.fam`** - Sample information file
- **`.cov`** - Covariate file (for logistic regression)

### 2. Data Organization

#### Option A: Local/Host Files
```
data/plink/
├── cohort1.bed
├── cohort1.bim
├── cohort1.fam
├── cohort1.cov
├── cohort2.bed
├── cohort2.bim
├── cohort2.fam
├── cohort2.cov
└── cohort3.bed
    ...
```

#### Option B: S3 Storage (Recommended)
```
s3://my-genomics-data/plink/
├── cohort1.bed
├── cohort1.bim
├── cohort1.fam
├── cohort1.cov
├── cohort2.bed
├── cohort2.bim
├── cohort2.fam
├── cohort2.cov
└── ...
```

## Usage

### Option 1: Unified Distributed Workflow (Mixed Storage) **← RECOMMENDED**

**Best for**: Real-world multi-institution studies with mixed storage

```bash
# 1. Set up S3 credentials for institutions that use S3
#    Each institution provides their own credentials
export HOSPITAL_B_AWS_KEY="hospital_b_access_key"
export HOSPITAL_B_AWS_SECRET="hospital_b_secret_key"
export HOSPITAL_D_AWS_KEY="hospital_d_access_key"
export HOSPITAL_D_AWS_SECRET="hospital_d_secret_key"

# 2. Edit plink-gwas-distributed.nf to configure your cohorts:
params.cohorts = [
    // Hospital A: Local storage
    [name: 'hospital_a', node: 'node-hospital-a',
     storage_type: 'local',
     data_path: '/data/genomics/hospital_a'],

    // Hospital B: Private S3 bucket
    [name: 'hospital_b', node: 'node-hospital-b',
     storage_type: 's3',
     data_path: 's3://hospital-b-genomics/cohort_b',
     s3_credentials: ['HOSPITAL_B_AWS_KEY', 'HOSPITAL_B_AWS_SECRET']],

    // Hospital C: Local storage
    [name: 'hospital_c', node: 'node-hospital-c',
     storage_type: 'local',
     data_path: '/mnt/nfs/genomics/hospital_c'],

    // Hospital D: Different private S3
    [name: 'hospital_d', node: 'node-hospital-d',
     storage_type: 's3',
     data_path: 's3://hospital-d-private/gwas/cohort_d',
     s3_credentials: ['HOSPITAL_D_AWS_KEY', 'HOSPITAL_D_AWS_SECRET']]
]

# 3. Run the workflow
nextflow run plink-gwas-distributed.nf -c plink-gwas.config \
  --outdir "results"
```

**What happens**:
1. **Hospital A**: Processes local data on `node-hospital-a` (no data movement)
2. **Hospital B**: Fetches from their S3 using their credentials, processes on `node-hospital-b`
3. **Hospital C**: Processes local data on `node-hospital-c` (no data movement)
4. **Hospital D**: Fetches from their S3 using their credentials, processes on `node-hospital-d`
5. Only GWAS summary statistics are collected
6. Meta-analysis combines the results
7. **No raw genotype data shared between institutions**
8. **No S3 credentials shared between institutions**

**Key features**:
- ✅ Mixed storage (local + S3) in ONE workflow
- ✅ Per-institution S3 credentials
- ✅ Maximum flexibility
- ✅ Privacy audit report
- ✅ HIPAA/GDPR compliant

### Option 2: Basic Version (Local Files)

```bash
# Run with default cohorts
nextflow run plink-gwas.nf -c plink-gwas.config

# Specify custom cohorts
nextflow run plink-gwas.nf -c plink-gwas.config \
  --cohorts "study1,study2,study3,study4" \
  --data_dir "/path/to/plink/data" \
  --outdir "results"
```

### Option 3: S3 Version (Cloud-Native Workflows)

```bash
# Set up AWS credentials (these will be securely passed to Bacalhau jobs)
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key"

# Run the workflow
nextflow run plink-gwas-s3.nf -c plink-gwas.config \
  --s3_bucket "s3://my-genomics-data/plink" \
  --cohorts "cohort1,cohort2,cohort3" \
  --outdir "results"
```

### Using Host Paths (Data Already on Remote Nodes)

If your data is already on the Bacalhau compute nodes:

```groovy
// Modify the input to use host:// prefix
val bed_path = "host:///data/genomics/cohort1.bed"
val bim_path = "host:///data/genomics/cohort1.bim"
val fam_path = "host:///data/genomics/cohort1.fam"
val cov_path = "host:///data/genomics/cohort1.cov"
```

## Configuration

Edit `plink-gwas.config` to customize:

```groovy
process {
    ext {
        bacalhauNode = 'https://api.bacalhau.org'
        maxRetries = 2

        // For S3 access, add credentials
        bacalhauSecrets = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
    }

    withName: 'runGWAS' {
        cpus = 2      // CPUs per cohort analysis
        memory = '4.GB'
        time = '30m'
    }

    withName: 'metaAnalysis' {
        cpus = 4      // CPUs for meta-analysis
        memory = '8.GB'
        time = '1h'
    }
}
```

## Understanding the Workflow

### Step 1: Parallel GWAS Analysis

Each cohort runs independently on a different Bacalhau node:

```bash
plink --bfile cohort1 \
      --logistic \
      --covar cohort1.cov \
      --ci 0.95 \
      --out cohort1
```

**Output per cohort**:
- `cohort1.assoc.logistic` - Association results
- `cohort1.log` - PLINK log file

### Step 2: Meta-Analysis

After all cohorts complete, results are combined:

```bash
plink --meta-analysis results_list.txt \
      --meta-analysis-snp-field SNP \
      --meta-analysis-chr-field CHR \
      --meta-analysis-bp-field BP \
      --meta-analysis-a1-field A1 \
      --meta-analysis-a2-field A2 \
      --meta-analysis-p-field P \
      --meta-analysis-se-field SE \
      --out meta_analysis
```

**Final output**:
- `meta_analysis.results` - Combined meta-analysis results
- `meta_analysis.log` - Meta-analysis log

## Results

After completion, you'll find in the `results/` directory:

```
results/
├── meta_analysis.results    # Main meta-analysis output
├── meta_analysis.log         # Log file
└── meta_analysis.*          # Additional PLINK output files
```

The meta-analysis results contain:
- SNP IDs
- Chromosomes and positions
- Alleles (A1/A2)
- Combined effect sizes
- Combined standard errors
- Combined p-values
- Heterogeneity statistics

## Example with Real Data

### Preparing Test Data

```bash
# Create test PLINK files (requires PLINK installed locally)
# This creates small test datasets for 3 cohorts

for cohort in cohort1 cohort2 cohort3; do
    # Generate random genotype data (replace with your real data)
    plink --dummy 100 1000 \
          --make-bed \
          --out data/plink/${cohort}

    # Create covariate file (age, sex, PC1-PC5)
    echo "FID IID AGE SEX PC1 PC2 PC3 PC4 PC5" > data/plink/${cohort}.cov
    # Add covariate data here...
done
```

### Running the Analysis

```bash
# Run locally first to test
nextflow run plink-gwas.nf -c plink-gwas.config \
  --cohorts "cohort1,cohort2,cohort3" \
  --data_dir "data/plink" \
  --outdir "results"
```

## Monitoring

The workflow generates detailed reports:

```bash
# View execution trace
cat plink-gwas-trace.txt

# Open HTML reports
open plink-gwas-timeline.html
open plink-gwas-report.html
```

## Advantages of Bacalhau for GWAS

1. **Data Privacy**: Data stays at source, only summary statistics are shared
2. **Scalability**: Process hundreds of cohorts in parallel
3. **Cost-Effective**: Pay only for compute time used
4. **No Data Movement**: Direct S3/host access eliminates data transfer bottlenecks
5. **Reproducibility**: Docker containers ensure consistent PLINK versions

## Troubleshooting

### Error: "Cannot read bed file"

Ensure all three binary files (.bed, .bim, .fam) have the same prefix:
```bash
# Correct
cohort1.bed, cohort1.bim, cohort1.fam

# Incorrect
cohort1.bed, cohort1_bim, cohort1.fam
```

### Error: "Covariate file not found"

Check that the covariate file uses the correct naming:
```bash
# Expected: cohort1.cov (matches the cohort name)
```

### S3 Access Issues

Ensure credentials are set and have read permissions:
```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."

# Test S3 access
aws s3 ls s3://my-genomics-data/plink/
```

### Memory Issues

Increase memory for large datasets:
```groovy
withName: 'runGWAS' {
    memory = '16.GB'  // Increase as needed
}
```

## Extending the Workflow

### Add Quality Control

```groovy
process qc {
    input:
    tuple val(cohort), path(bed), path(bim), path(fam)

    script:
    """
    plink --bfile ${cohort} \
          --geno 0.05 \
          --maf 0.01 \
          --hwe 1e-6 \
          --make-bed \
          --out ${cohort}_qc
    """
}
```

### Add Manhattan Plot Generation

```groovy
process manhattanPlot {
    container 'r-base:latest'

    input:
    path results

    output:
    path "manhattan.png"

    script:
    """
    #!/usr/bin/env Rscript
    library(qqman)
    data <- read.table("${results}", header=TRUE)
    png("manhattan.png", width=1200, height=600)
    manhattan(data, chr="CHR", bp="BP", p="P", snp="SNP")
    dev.off()
    """
}
```

## References

- [PLINK Documentation](https://www.cog-genomics.org/plink/)
- [PLINK Meta-Analysis](https://www.cog-genomics.org/plink/1.9/meta)
- [Bacalhau Documentation](https://docs.bacalhau.org/)
- [Nextflow Documentation](https://www.nextflow.io/docs/latest/)
