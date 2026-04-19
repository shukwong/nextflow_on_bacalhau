# Nextflow Bacalhau Executor

A Nextflow executor plugin for running workflows on [Bacalhau](https://bacalhau.org), a distributed compute orchestration framework.

## Overview

This plugin enables Nextflow workflows to execute on Bacalhau's distributed compute network, bringing computation closer to data and leveraging distributed resources across multiple nodes.

## Installation

### Prerequisites

1. **Bacalhau CLI**: Install Bacalhau following the [official installation guide](https://docs.bacalhau.org/getting-started/installation)
2. **Nextflow**: Version 24.10.0 or later
3. **Java**: JDK 21 (required only when building the plugin from source)

### Option A — Install from the Nextflow Plugin Registry

Once published to the [Nextflow Plugin Registry](https://registry.nextflow.io), the
plugin can be installed by Nextflow directly — no local build required:

```groovy
// nextflow.config
plugins {
    id 'nf-bacalhau@0.1.0'
}
```

Nextflow will download and cache the plugin on first run.

### Option B — Build and Install Locally

```bash
# Clone the repository
git clone https://github.com/nextflow-io/nextflow-bacalhau-executor
cd nextflow-bacalhau-executor

# Build the plugin
make assemble       # or: ./gradlew assemble

# Install into ~/.nextflow/plugins
make install        # or: ./gradlew install
```

## Configuration

Configure your Nextflow workflow to use the Bacalhau executor:

```groovy
// nextflow.config
plugins {
    id 'nf-bacalhau@0.1.0'
}

process {
    executor = 'bacalhau'
}

// Dedicated Bacalhau scope (preferred — takes precedence over process.ext)
bacalhau {
    bacalhauCliPath   = 'bacalhau'                 // Path to the Bacalhau CLI binary
    bacalhauNode      = 'https://api.bacalhau.org' // API endpoint
    waitForCompletion = true                       // Wait for job completion
    maxRetries        = 3                          // Retry failed jobs (must be >= 0)
    storageEngine     = 'ipfs'                     // One of: 'ipfs', 's3', 'local'
    s3Region          = 'us-east-1'                // AWS region for s3:// inputs
}
```

All options above may also be supplied under `process.ext`, but the dedicated
`bacalhau { }` block wins when both are set.

### Configuration Reference

| Option | Default | Description |
|---|---|---|
| `bacalhauCliPath` | `bacalhau` | Path to the Bacalhau CLI binary |
| `bacalhauNode` | `https://api.bacalhau.org` | Bacalhau API endpoint |
| `waitForCompletion` | `true` | Wait for job completion |
| `maxRetries` | `3` | Retry count for failed jobs (non-negative) |
| `storageEngine` | `ipfs` | Storage backend: `ipfs`, `s3`, or `local` |
| `s3Region` | `us-east-1` | AWS region used for `s3://` input sources |

## Usage

### Basic Example

```groovy
// main.nf
process sayHello {
    container 'ubuntu:latest'
    
    input:
    val name
    
    output:
    stdout
    
    script:
    """
    echo "Hello, ${name} from Bacalhau!"
    """
}

workflow {
    names = Channel.of('World', 'Nextflow', 'Bacalhau')
    sayHello(names) | view
}
```

Run the workflow:

```bash
nextflow run main.nf -with-docker
```

### Resource Constraints

Specify compute resources using standard Nextflow directives:

```groovy
process computeTask {
    container 'python:3.9'
    cpus 2
    memory '4.GB'
    disk '10.GB'  // Optional disk requirement
    time '30m'
    accelerator 1 // Requests 1 GPU
    
    script:
    """
    python -c "import time; print('Computing...'); time.sleep(10)"
    """
}
```

Supported resource directives: `cpus`, `memory`, `disk`, `time`, `accelerator`.

### Data Handling

**S3 Inputs:**
To process data directly from S3 without downloading it to your local machine first, simply pass the `s3://` URI string to the process input. The executor will configure the Bacalhau job to fetch it directly.

```groovy
process analyzeS3 {
    input:
    val s3_path // e.g. "s3://my-bucket/data.csv"
    
    script:
    """
    # File is mounted at /inputs/<filename>
    process_data /inputs/data.csv
    """
}
```

**Host Path Inputs:**
To use files that already exist on the remote node's filesystem (where the compute job runs), use the `host://` prefix. This creates a bind mount from the host path to the container input path.

```groovy
process analyzeLocal {
    input:
    val local_path // e.g. "host:///data/reference_genome.fa"
    
    script:
    """
    # File is mounted at /inputs/reference_genome.fa
    process_data /inputs/reference_genome.fa
    """
}
```

**Secrets:**
To pass sensitive information (like API keys or AWS credentials) to the remote job, define them in your `nextflow.config` under `ext.bacalhauSecrets`. These must match environment variables available in your local shell.

```groovy
// nextflow.config
process {
    executor = 'bacalhau'
    ext.bacalhauSecrets = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
}
```

## Features

- **Docker Container Support**: Executes processes in Docker containers
- **Resource Management**: CPU, memory, disk, time, and GPU (`accelerator`) constraints
- **Job Monitoring**: Cached queue-status polling with failure backoff
- **Error Handling**: Comprehensive error reporting and retry mechanisms
- **Distributed Computing**: Leverages Bacalhau's distributed network
- **Native S3 and `host://` Input Sources**: Fetch directly from S3 or bind-mount node-local paths
- **Secret Injection**: Forward local environment variables to jobs via `ext.bacalhauSecrets`

## Development Status

**Completed (Phase 1, 2 & 3):**
- ✅ Core executor infrastructure
- ✅ Basic job submission and monitoring
- ✅ Docker container support
- ✅ Script and input file staging
- ✅ Output file retrieval and verification
- ✅ Advanced resource management (GPU, Env Vars)
- ✅ Native S3 Input Support
- ✅ Host Path Input Support
- ✅ Secret Injection via Config
- ✅ Comprehensive error handling with timeouts
- ✅ Configuration validation and loading
- ✅ Thread-safe synchronization
- ✅ Strict job ID validation
- ✅ JSON-based queue status parsing
- ✅ Input validation and security hardening

**Phase 4 (in progress):**
- ✅ Nextflow Plugin Registry packaging (`io.nextflow.nextflow-plugin` Gradle plugin)
- 🚧 Performance tuning and optimization
- 🚧 Extensive integration testing with live Bacalhau cluster
- 🚧 Advanced networking configuration
- 🚧 Comprehensive documentation and examples

## Development

### Building

```bash
make assemble         # or: ./gradlew assemble
```

### Testing

```bash
make test             # or: ./gradlew test
```

### Integration Testing

```bash
make integration-test # or: ./gradlew integrationTest
```

### Publishing to the Nextflow Plugin Registry

1. Claim the plugin at <https://registry.nextflow.io/claim-plugin> using the
   `provider` declared in `build.gradle` (currently `nf-bacalhau`).
2. Add your registry access token to `$HOME/.gradle/gradle.properties`:
   ```
   npr.apiKey=<your-token>
   ```
   Alternatively, export `NPR_API_KEY` in the environment.
3. Release:
   ```bash
   make release       # or: ./gradlew releasePlugin
   ```

## Contributing

Contributions are welcome! Please see the [contributing guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- [Nextflow Community Forum](https://community.nextflow.io)
- [Bacalhau Documentation](https://docs.bacalhau.org)
- [GitHub Issues](https://github.com/nextflow-io/nextflow-bacalhau-executor/issues)