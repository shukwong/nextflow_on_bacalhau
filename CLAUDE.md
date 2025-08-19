# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository implements a Nextflow executor plugin for Bacalhau, enabling Nextflow workflows to run on Bacalhau's distributed compute network. The integration follows the **Executor Plugin** approach, creating a custom Nextflow executor that submits jobs to Bacalhau.

## Key Concepts

- **Nextflow**: Workflow management system using dataflow programming model
- **Bacalhau**: Distributed compute orchestration framework that brings compute to data
- **Executor Plugin**: Nextflow extension that handles job submission to specific compute environments
- **TaskHandler**: Manages individual task lifecycle (submission, monitoring, completion)
- **Job Translation**: Converting Nextflow process definitions to Bacalhau job specifications

## Architecture

The Bacalhau executor follows Nextflow's established patterns:

```
BacalhauExecutor extends AbstractGridExecutor
├── BacalhauTaskHandler extends GridTaskHandler  
├── BacalhauTaskMonitor extends TaskPollingMonitor
└── Configuration via process.executor = 'bacalhau'
```

### Core Components

1. **BacalhauExecutor**: Main executor class managing job lifecycle
2. **BacalhauTaskHandler**: Individual task submission and monitoring via Bacalhau CLI
3. **Job Translation Layer**: Maps Nextflow directives to Bacalhau job parameters
4. **Status Polling**: Monitors job status using `bacalhau list/describe` commands

## Development Commands

### Build and Test
```bash
./gradlew build                    # Build the plugin
./gradlew test                     # Run unit tests  
./gradlew integrationTest          # Run integration tests
```

### Plugin Development
```bash
./gradlew publishToMavenLocal      # Publish plugin locally
./gradlew generatePom              # Generate POM for distribution
```

## Project Structure

```
src/main/groovy/nextflow/executor/
├── BacalhauExecutor.groovy        # Main executor implementation
├── BacalhauTaskHandler.groovy     # Task lifecycle management
└── BacalhauTaskMonitor.groovy     # Job status polling

src/test/groovy/
├── BacalhauExecutorTest.groovy    # Unit tests
└── BacalhauIntegrationTest.groovy # Integration tests

src/main/resources/META-INF/
└── extensions.idx                 # Plugin service registration
```

## Configuration

The executor is configured in `nextflow.config`:

```groovy
process {
    executor = 'bacalhau'
    
    ext {
        bacalhauNode = 'https://api.bacalhau.org'  # API endpoint  
        waitForCompletion = true                    # Job submission mode
        maxRetries = 3                             # Retry failed jobs
        storageEngine = 'ipfs'                     # Storage backend
    }
}
```

## Implementation Phases

### Phase 1: Core Infrastructure
- Basic BacalhauExecutor extending AbstractGridExecutor
- Bacalhau CLI integration for job operations  
- Plugin metadata and service registration

### Phase 2: Job Translation
- Map Nextflow process directives to Bacalhau job specs
- Docker container support and resource allocation
- Input/output file handling strategies

### Phase 3: Monitoring & Status
- Job status polling and state mapping
- Error handling, retry mechanisms, and log collection
- Result retrieval from completed jobs

### Phase 4: Advanced Features  
- Bacalhau-specific configurations (storage, networking)
- Performance optimizations and comprehensive testing
- Documentation and production deployment

## Key Technical Challenges

1. **Asynchronous Job Management**: Polling-based monitoring with configurable intervals
2. **File Staging**: Input/output management across distributed nodes using Bacalhau storage
3. **Resource Mapping**: Translating Nextflow specs (cpus, memory, time) to Bacalhau limits
4. **Error Handling**: Distinguishing Bacalhau vs task execution errors through CLI parsing