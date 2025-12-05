# Nextflow Bacalhau Executor Examples

This directory contains example workflows demonstrating the Bacalhau executor.

## Prerequisites

1. **Install Bacalhau CLI**:
   ```bash
   curl -sL https://get.bacalhau.org/install.sh | bash
   ```

2. **Verify installation**:
   ```bash
   bacalhau version
   ```

3. **Build and install the plugin**:
   ```bash
   cd ..
   ./gradlew publishToMavenLocal
   ```

## Examples Overview

### 1. Minimal Example (Quickstart)

**Location**: `minimal.nf` and `minimal.config` (in this directory)

The absolute simplest example - perfect for testing the executor is working.

```bash
cd examples
nextflow run minimal.nf -c minimal.config
```

**Output**: Just prints "Hello from Bacalhau!"

📖 [Start here if you're new to the Bacalhau executor]

---

### 2. Hello World (Parallel Execution)

**Location**: [`hello-world/`](hello-world/)

Demonstrates parallel task execution with multiple greetings.

```bash
cd examples/hello-world
nextflow run hello-world.nf
```

**Features**:
- 5 parallel tasks with different greetings
- Shows distributed execution across Bacalhau nodes
- Includes comprehensive configuration examples
- Generates execution reports

📖 **[Full Documentation →](hello-world/README.md)**

---

### 3. PLINK GWAS Meta-Analysis (Real-World Bioinformatics)

**Location**: [`plink-gwas/`](plink-gwas/)

Production-ready example for distributed genomics analysis.

```bash
cd examples/plink-gwas

# Run the workflow (supports mixed storage: local + S3)
nextflow run plink-gwas.nf -c plink-gwas.config
```

**Features**:
- Parallel GWAS analysis on multiple cohorts/datasets
- Meta-analysis of combined results
- **Mixed storage support**: local + S3 in single workflow
- Per-institution S3 credentials (no sharing)
- Privacy-preserving (data stays at source)
- Demonstrates: `plink --logistic --covar` and `plink --meta-analysis`

**Use Cases**:
- Multi-center genomics studies
- Chromosome-wise parallel analysis
- Large-scale distributed GWAS

📖 **[Full Documentation →](plink-gwas/README.md)**

---

## Quick Reference

### File Organization

```
examples/
├── README.md                  # This file
├── minimal.nf                 # Simplest example (1 task)
├── minimal.config             # Minimal configuration
├── hello-world/               # Parallel execution example
│   ├── README.md
│   ├── hello-world.nf
│   └── nextflow.config
└── plink-gwas/                # Real-world bioinformatics example
    ├── README.md
    ├── plink-gwas.nf              # Main workflow (mixed local + S3)
    ├── plink-gwas.config          # Configuration
    └── DATA_SCENARIOS.md          # Detailed guide
```

### Configuration Basics

All examples use the Bacalhau executor with similar configuration patterns:

```groovy
process {
    executor = 'bacalhau'
    container = 'ubuntu:latest'

    ext {
        bacalhauNode = 'https://api.bacalhau.org'
        waitForCompletion = true
        maxRetries = 3
        storageEngine = 'ipfs'
    }
}
```

### Advanced Features

#### S3 Input Support

```groovy
process analyzeData {
    container 'python:3.9'

    input:
    val s3_path  // e.g., "s3://my-bucket/data.csv"

    script:
    """
    # File automatically mounted at /inputs/data.csv
    python process_data.py /inputs/data.csv
    """
}
```

#### Secret Injection

```groovy
// In nextflow.config
process {
    ext.bacalhauSecrets = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
}
```

#### Resource Constraints

```groovy
process compute {
    container 'tensorflow/tensorflow:latest-gpu'
    cpus 4
    memory '8.GB'
    time '30m'
    accelerator 1  // Request 1 GPU

    script:
    """
    python train_model.py
    """
}
```

#### Host Path Mounting

```groovy
input:
val host_path  // e.g., "host:///data/reference_genome.fa"

// File mounted from remote node's filesystem
```

## Troubleshooting

### Plugin not found

```bash
cd ..
./gradlew clean publishToMavenLocal
```

### Bacalhau CLI not found

```bash
# Check PATH
which bacalhau

# Or set explicit path in nextflow.config
process.ext.bacalhauCliPath = '/path/to/bacalhau'
```

### Jobs not starting

```bash
# Check Bacalhau node connectivity
bacalhau node list

# Check job status manually
bacalhau job list
```

### View logs

```bash
# Nextflow log
.nextflow.log

# Execution trace (if enabled in config)
cat trace.txt
```

## Learning Path

**For beginners**:
1. Start with `minimal.nf` to verify everything works
2. Try `hello-world/` to understand parallel execution
3. Study the configurations to learn available options

**For bioinformatics users**:
1. Jump to `plink-gwas/` for a real-world genomics workflow
2. Adapt the PLINK example to your specific analysis needs
3. Learn S3 integration for cloud-native workflows

## Resources

- [Nextflow Documentation](https://www.nextflow.io/docs/latest/)
- [Bacalhau Documentation](https://docs.bacalhau.org/)
- [Plugin README](../README.md)
- [PLINK Documentation](https://www.cog-genomics.org/plink/)

## Support

For issues or questions:
- [GitHub Issues](https://github.com/nextflow-io/nextflow-bacalhau-executor/issues)
- [Nextflow Community Forum](https://community.nextflow.io)
- [Bacalhau Slack](https://bacalhauproject.slack.com)
