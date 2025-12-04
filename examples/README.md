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

## Quick Start

### Option 1: Absolute Minimal (Single Task)

The `minimal.nf` example runs a single task - perfect for initial testing:

```bash
cd examples
nextflow run minimal.nf -c minimal.config
```

Output:
```
Hello from Bacalhau!
```

### Option 2: Hello World (Multiple Tasks)

The `hello-world.nf` example demonstrates parallel execution:

```bash
cd examples
nextflow run hello-world.nf
```

### What it does:

- Creates 5 parallel tasks with different greetings
- Each task runs in an Ubuntu container on Bacalhau
- Prints greeting, hostname, and timestamp
- Demonstrates basic Bacalhau executor functionality

### Expected output:

```
N E X T F L O W  ~  version 23.10.x
Launching `hello-world.nf` [...]

executor >  bacalhau (5)
[xx/xxxxxx] process > sayHello (5) [100%] 5 of 5 ✔

Hello from Bacalhau distributed compute!
Running on node: bacalhau-node-xyz
Current time: Wed Dec  4 20:00:00 UTC 2024

Hola from Bacalhau distributed compute!
Running on node: bacalhau-node-abc
...
```

## Configuration

The `nextflow.config` file shows all available Bacalhau-specific settings:

```groovy
process {
    executor = 'bacalhau'

    ext {
        bacalhauNode = 'https://api.bacalhau.org'  // API endpoint
        waitForCompletion = true                    // Wait for jobs
        maxRetries = 3                             // Retry failed jobs
        storageEngine = 'ipfs'                     // Storage backend
    }
}
```

## Advanced Examples

### Example with S3 Input:

```groovy
process analyzeData {
    container 'python:3.9'

    input:
    val s3_path  // e.g., "s3://my-bucket/data.csv"

    script:
    """
    # File is automatically mounted at /inputs/data.csv
    python -c "import pandas as pd; print(pd.read_csv('/inputs/data.csv'))"
    """
}
```

### Example with Secrets:

```groovy
// In nextflow.config
process {
    ext.bacalhauSecrets = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
}

// These environment variables are securely injected into your job
```

### Example with Resources:

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

## Troubleshooting

### Plugin not found:
```bash
# Rebuild and republish
cd ..
./gradlew clean publishToMavenLocal
```

### Bacalhau CLI not found:
```bash
# Check PATH
which bacalhau

# Or set explicit path in nextflow.config
process.ext.bacalhauCliPath = '/path/to/bacalhau'
```

### Jobs not starting:
```bash
# Check Bacalhau node connectivity
bacalhau node list

# Check job status manually
bacalhau job list
```

## More Information

- [Nextflow Documentation](https://www.nextflow.io/docs/latest/)
- [Bacalhau Documentation](https://docs.bacalhau.org/)
- [Plugin README](../README.md)
