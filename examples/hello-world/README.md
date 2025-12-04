# Hello World Example

A simple example demonstrating parallel task execution with the Bacalhau executor.

## Files

- `hello-world.nf` - Main workflow with 5 parallel tasks
- `nextflow.config` - Configuration with detailed settings

## Quick Start

```bash
cd examples/hello-world
nextflow run hello-world.nf
```

## What it does

- Creates 5 parallel tasks with different greetings (Hello, Hola, Bonjour, Guten Tag, こんにちは)
- Each task runs in an Ubuntu container on Bacalhau
- Prints greeting, hostname, and timestamp from each node
- Demonstrates basic Bacalhau executor functionality

## Expected Output

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
Current time: Wed Dec  4 20:00:01 UTC 2024

Bonjour from Bacalhau distributed compute!
Running on node: bacalhau-node-def
Current time: Wed Dec  4 20:00:02 UTC 2024

Guten Tag from Bacalhau distributed compute!
Running on node: bacalhau-node-ghi
Current time: Wed Dec  4 20:00:03 UTC 2024

こんにちは from Bacalhau distributed compute!
Running on node: bacalhau-node-jkl
Current time: Wed Dec  4 20:00:04 UTC 2024
```

## Configuration

The `nextflow.config` file demonstrates all available Bacalhau-specific settings:

```groovy
process {
    executor = 'bacalhau'
    container = 'ubuntu:latest'

    // Default resource limits
    cpus = 1
    memory = '1.GB'
    time = '10m'

    // Bacalhau-specific settings
    ext {
        bacalhauNode = 'https://api.bacalhau.org'
        waitForCompletion = true
        maxRetries = 3
        storageEngine = 'ipfs'
    }
}
```

## Customization

### Change the greetings:

Edit `hello-world.nf`:
```groovy
workflow {
    greetings = Channel.of('Welcome', 'Bienvenue', 'Willkommen')
    sayHello(greetings) | view
}
```

### Add more resources:

Edit `nextflow.config`:
```groovy
process {
    cpus = 2
    memory = '2.GB'
}
```

### Use a different container:

Edit `hello-world.nf`:
```groovy
process sayHello {
    container 'alpine:latest'  // Smaller, faster image
    ...
}
```

## Monitoring

The configuration generates execution reports:

- `bacalhau-trace.txt` - Detailed execution trace
- `bacalhau-timeline.html` - Visual timeline of task execution
- `bacalhau-report.html` - Comprehensive execution report

View them after the run completes:
```bash
open bacalhau-timeline.html
open bacalhau-report.html
```

## Next Steps

- Try the [minimal example](../minimal.nf) for the simplest possible workflow
- See the [PLINK GWAS example](../plink-gwas/) for a real-world bioinformatics use case
- Read the [main examples README](../README.md) for more information
