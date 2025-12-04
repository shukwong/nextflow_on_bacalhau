# PLINK GWAS Data Distribution Scenarios

This document clarifies where data lives in each scenario and what moves across the network.

## Scenario 1: Federated (Data on Remote Nodes) ✅ RECOMMENDED

**File**: `plink-gwas-federated.nf`

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Nextflow Controller                      │
│              (Submits jobs, collects results)               │
└─────────────────────────────────────────────────────────────┘
                     │           │           │
          ┌──────────┘           │           └──────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   Node A         │   │   Node B         │   │   Node C         │
│  (Hospital A)    │   │  (Hospital B)    │   │  (Hospital C)    │
│                  │   │                  │   │                  │
│  📁 Raw Data:    │   │  📁 Raw Data:    │   │  📁 Raw Data:    │
│  cohort_a.bed ✅ │   │  cohort_b.bed ✅ │   │  cohort_c.bed ✅ │
│  cohort_a.bim ✅ │   │  cohort_b.bim ✅ │   │  cohort_c.bim ✅ │
│  cohort_a.fam ✅ │   │  cohort_b.fam ✅ │   │  cohort_c.fam ✅ │
│  cohort_a.cov ✅ │   │  cohort_b.cov ✅ │   │  cohort_c.cov ✅ │
│                  │   │                  │   │                  │
│  ⚙️  PLINK runs   │   │  ⚙️  PLINK runs   │   │  ⚙️  PLINK runs   │
│     locally      │   │     locally      │   │     locally      │
│                  │   │                  │   │                  │
│  📊 Output:      │   │  📊 Output:      │   │  📊 Output:      │
│  summary stats   │   │  summary stats   │   │  summary stats   │
└──────────────────┘   └──────────────────┘   └──────────────────┘
          │                      │                      │
          └──────────┐           │           ┌──────────┘
                     ▼           ▼           ▼
            ┌─────────────────────────────────────┐
            │  Meta-Analysis (Any node)           │
            │  Combines summary statistics        │
            │  📊 → 📊 → 📊 → Final Results       │
            └─────────────────────────────────────┘
```

### Data Movement

| Data Type | Leaves Source Node? | Size |
|-----------|-------------------|------|
| Raw genotypes (.bed, .bim, .fam) | ❌ NO | Gigabytes |
| Covariates (.cov) | ❌ NO | Kilobytes |
| Summary statistics (.assoc.logistic) | ✅ YES | Megabytes |

### Privacy Guarantees

✅ **Raw genotype data NEVER leaves the institution**
✅ **No individual-level data shared**
✅ **Only aggregate statistics shared**
✅ **HIPAA compliant** (no PHI transmitted)
✅ **GDPR compliant** (no personal data transmitted)

### Use Cases

- Multi-hospital genomics studies
- International consortia with data sovereignty requirements
- Studies with IRB restrictions on data sharing
- Privacy-preserving collaborative research

---

## Scenario 2: S3 Centralized Storage

**File**: `plink-gwas-s3.nf`

### Architecture

```
                    ┌─────────────────────┐
                    │   S3 Bucket         │
                    │                     │
                    │  📁 All cohorts:    │
                    │  cohort_a.bed       │
                    │  cohort_a.bim       │
                    │  cohort_a.fam       │
                    │  cohort_b.bed       │
                    │  cohort_b.bim       │
                    │  cohort_b.fam       │
                    │  cohort_c.bed       │
                    │  cohort_c.bim       │
                    │  cohort_c.fam       │
                    └─────────────────────┘
                     │         │         │
          ┌──────────┘         │         └──────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Bacalhau       │ │   Bacalhau       │ │   Bacalhau       │
│   Node A         │ │   Node B         │ │   Node C         │
│                  │ │                  │ │                  │
│  ⬇️ Downloads:    │ │  ⬇️ Downloads:    │ │  ⬇️ Downloads:    │
│  cohort_a.*      │ │  cohort_b.*      │ │  cohort_c.*      │
│                  │ │                  │ │                  │
│  ⚙️  PLINK runs   │ │  ⚙️  PLINK runs   │ │  ⚙️  PLINK runs   │
│                  │ │                  │ │                  │
│  📊 Output       │ │  📊 Output       │ │  📊 Output       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

### Data Movement

| Data Type | Source | Destination | Size |
|-----------|--------|-------------|------|
| Raw genotypes | S3 | Bacalhau nodes | Gigabytes |
| Summary statistics | Bacalhau nodes | Controller | Megabytes |

### Characteristics

⚠️ **Requires data centralization** (all data must be in S3)
✅ **Good for cloud-native workflows**
✅ **No permanent storage on compute nodes**
✅ **Bacalhau handles S3 authentication**

### Use Cases

- Cloud-first genomics pipelines
- Single institution with multiple datasets
- When data centralization is acceptable

---

## Scenario 3: Local Staging

**File**: `plink-gwas.nf`

### Architecture

```
┌─────────────────────┐
│  Local Machine      │
│  (Where Nextflow    │
│   runs)             │
│                     │
│  📁 All cohorts:    │
│  cohort_a.bed       │
│  cohort_a.bim       │
│  cohort_a.fam       │
│  cohort_b.*         │
│  cohort_c.*         │
└─────────────────────┘
          │
          │ (uploads data for each job)
          │
          ▼
┌─────────────────────┐
│  Bacalhau Nodes     │
│  (Data uploaded     │
│   per task)         │
│                     │
│  ⚙️  PLINK runs      │
│  📊 Outputs         │
└─────────────────────┘
```

### Data Movement

| Data Type | Source | Destination | Size |
|-----------|--------|-------------|------|
| Raw genotypes | Local machine | Each Bacalhau job | Gigabytes |
| Summary statistics | Bacalhau jobs | Local machine | Megabytes |

### Characteristics

⚠️ **High network usage** (uploads data for each job)
⚠️ **Slow for large datasets**
✅ **Good for testing and development**
✅ **Simple to set up**

### Use Cases

- Testing workflows
- Small datasets
- Proof-of-concept runs

---

## Comparison Table

| Feature | Federated | S3 | Local |
|---------|-----------|-----|-------|
| **Data privacy** | ✅ Excellent | ⚠️ Centralized | ⚠️ Uploaded |
| **Network usage** | 📊 Low (summary only) | 💾 Medium (S3 to nodes) | 💾💾 High (upload all) |
| **Setup complexity** | 🔧 Medium | 🔧 Low | 🔧 Very Low |
| **Best for** | Multi-institution | Cloud workflows | Testing |
| **HIPAA/GDPR** | ✅ Compliant | ⚠️ Depends | ⚠️ Depends |
| **Data sovereignty** | ✅ Yes | ❌ No | ❌ No |

---

## How to Choose

### Choose **Federated** if:
- ✅ You have multi-institutional data
- ✅ Data cannot leave source institutions
- ✅ IRB restrictions on data sharing
- ✅ Privacy/compliance is critical

### Choose **S3** if:
- ✅ All data can be centralized
- ✅ You prefer cloud-native workflows
- ✅ Data is already in S3

### Choose **Local** if:
- ✅ You're testing the workflow
- ✅ You have small datasets
- ✅ You want the simplest setup

---

## Example: Real-World Federated Study

**Study**: International GWAS consortium with 5 hospitals

### Setup

```groovy
// In plink-gwas-federated.nf
params.cohorts = [
    // US Hospital
    [name: 'hospital_boston',
     node: 'node-boston-hpc',
     data_path: '/gpfs/genomics/gwas_cohort1'],

    // UK Hospital
    [name: 'hospital_london',
     node: 'node-london-hpc',
     data_path: '/mnt/nfs/genomics/uk_cohort'],

    // German Hospital
    [name: 'hospital_berlin',
     node: 'node-berlin-cluster',
     data_path: '/data/genomics/de_cohort'],

    // Japanese Hospital
    [name: 'hospital_tokyo',
     node: 'node-tokyo-hpc',
     data_path: '/scratch/genomics/jp_cohort'],

    // Australian Hospital
    [name: 'hospital_sydney',
     node: 'node-sydney-hpc',
     data_path: '/home/genomics/au_cohort']
]
```

### What Happens

1. **Boston node** processes Boston data locally
2. **London node** processes London data locally
3. **Berlin node** processes Berlin data locally
4. **Tokyo node** processes Tokyo data locally
5. **Sydney node** processes Sydney data locally
6. **Only summary statistics** travel between sites
7. **Meta-analysis** combines results
8. **No raw genotypes** ever cross international borders

### Compliance

✅ Each country's data stays within its borders
✅ HIPAA compliance (USA)
✅ GDPR compliance (Europe)
✅ No PHI/PII transmitted
✅ IRB requirements satisfied
✅ Data sovereignty maintained
