# Nextflow Bacalhau Executor

A Nextflow executor plugin for running workflows on [Bacalhau](https://bacalhau.org), a distributed compute orchestration framework.

## Overview

This plugin enables Nextflow workflows to execute on Bacalhau's distributed compute network, bringing computation closer to data and leveraging distributed resources across multiple nodes.

## Installation

### Prerequisites

1. **Bacalhau CLI**: Install Bacalhau following the [official installation guide](https://docs.bacalhau.org/getting-started/installation)
2. **Nextflow**: Version 23.10.0 or later

### Build and Install

```bash
# Clone the repository
git clone https://github.com/nextflow-io/nextflow-bacalhau-executor
cd nextflow-bacalhau-executor

# Build the plugin
./gradlew build

# Publish to local Maven repository
./gradlew publishToMavenLocal
```

## Configuration

Configure your Nextflow workflow to use the Bacalhau executor:

```groovy
// nextflow.config
plugins {
    id 'nf-bacalhau@0.1.0-SNAPSHOT'
}

process {
    executor = 'bacalhau'
    
    // Bacalhau-specific configuration
    ext {
        bacalhauNode = 'https://api.bacalhau.org'  // Optional: API endpoint
        waitForCompletion = true                    // Wait for job completion
        maxRetries = 3                             // Retry failed jobs
    }
}
```

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
    time '30m'
    
    script:
    """
    python -c "import time; print('Computing...'); time.sleep(10)"
    """
}
```

## Features

- **Docker Container Support**: Executes processes in Docker containers
- **Resource Management**: CPU, memory, and time constraints
- **Job Monitoring**: Real-time status tracking and logging
- **Error Handling**: Comprehensive error reporting and retry mechanisms
- **Distributed Computing**: Leverages Bacalhau's distributed network

## Development Status

This is currently transitioning to **Phase 3** development:

**Completed (Phase 1 & 2):**
- ✅ Core executor infrastructure
- ✅ Basic job submission and monitoring
- ✅ Docker container support
- ✅ Script and input file staging
- ✅ Output file retrieval
- ✅ Advanced resource management (GPU, Env Vars)

**Upcoming (Phase 3):**
- 🚧 Comprehensive error handling
- 🚧 Performance tuning
- 🚧 Integration with IPFS for large datasets
- 🚧 Extensive integration testing

## Development

### Building

```bash
./gradlew build
```

### Testing

```bash
./gradlew test
```

### Integration Testing

```bash
./gradlew integrationTest
```

## Contributing

Contributions are welcome! Please see the [contributing guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

- [Nextflow Community Forum](https://community.nextflow.io)
- [Bacalhau Documentation](https://docs.bacalhau.org)
- [GitHub Issues](https://github.com/nextflow-io/nextflow-bacalhau-executor/issues)