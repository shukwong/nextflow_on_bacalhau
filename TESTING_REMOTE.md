# Testing with a Remote Bacalhau Node

This guide explains how to run Nextflow workflows against a remote Bacalhau node using the `nf-bacalhau` plugin.

## Prerequisite: Bacalhau CLI

The plugin relies on the `bacalhau` CLI installed on your machine. Ensure it is installed and available in your `PATH`.

## Step 1: Configure Connection

The plugin inherits your shell's environment variables. Configure the Bacalhau CLI to point to your remote node:

```bash
# Set the host (IP or Domain)
export BACALHAU_API_HOST=YOUR_REMOTE_IP

# Set the port (Default is 1234)
export BACALHAU_API_PORT=1234

# Optional: If your node requires a token/auth
# export BACALHAU_API_TOKEN=your_token
```

**Verify the connection:**
Run this command to ensure you can see the remote node:
```bash
bacalhau node list
```
*If this command fails, Nextflow will also fail.*

## Step 2: Build and Install the Plugin

You must publish the plugin to your local Maven repository (`~/.m2`) so Nextflow can load it.

**Option A: Using Docker (Recommended if Java 17 is missing)**
```bash
docker run --rm \
    -v "$PWD":/home/gradle/project \
    -w /home/gradle/project \
    gradle:jdk17 \
    gradle publishToMavenLocal
```

**Option B: Using Local Gradle**
```bash
./gradlew publishToMavenLocal
```

## Step 3: Run a Test Workflow

1. Create a `nextflow.config` file in your test folder:
   ```groovy
   plugins {
       id 'nf-bacalhau@0.1.0-SNAPSHOT'
   }

   process {
       executor = 'bacalhau'
       container = 'ubuntu:latest' // Required for Bacalhau
   }
   ```

2. Create a simple `main.nf` script:
   ```groovy
   process remoteTask {
       input:
       val x
       
       output:
       stdout
       
       script:
       """
       echo "Processing $x on Host: $(hostname)"
       """
   }

   workflow {
       Channel.of(1, 2, 3) | remoteTask | view
   }
   ```

3. Run it:
   ```bash
   nextflow run main.nf
   ```

## Troubleshooting

*   **"Plugin not found"**: Ensure you ran `publishToMavenLocal` successfully and that `~/.m2/repository/io/nextflow/nf-bacalhau/` exists.
*   **"Connection refused"**: Double-check your `BACALHAU_API_HOST` variable.
*   **"File not found"**: Remember that files on your local machine are mapped to `/tmp` inside the container. The plugin handles this automatically for input files declared in the process `input:` block.
