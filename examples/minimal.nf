#!/usr/bin/env nextflow

/*
 * Absolute minimal example - single task
 */

process hello {
    container 'ubuntu:latest'

    script:
    """
    echo "Hello from Bacalhau!"
    """
}

workflow {
    hello()
}
