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

Install the plugin into your local Nextflow plugins directory (`~/.nextflow/plugins`) so Nextflow can load it. Building the plugin requires **JDK 21**.

**Option A: Using Local Gradle / Make**
```bash
make install        # or: ./gradlew install
```

**Option B: Using Docker (if JDK 21 is missing locally)**
```bash
docker run --rm \
    -v "$PWD":/home/gradle/project \
    -v "$HOME/.nextflow":/home/gradle/.nextflow \
    -w /home/gradle/project \
    gradle:jdk21 \
    gradle install
```

## Step 3: Run a Test Workflow

1. Create a `nextflow.config` file in your test folder:
   ```groovy
   plugins {
       id 'nf-bacalhau@0.1.0'
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

*   **"Plugin not found"**: Ensure you ran `make install` (or `./gradlew install`) successfully and that `~/.nextflow/plugins/nf-bacalhau-0.1.0/` exists.
*   **"Connection refused"**: Double-check your `BACALHAU_API_HOST` variable.
*   **"File not found"**: Remember that files on your local machine are mapped to `/tmp` inside the container. The plugin handles this automatically for input files declared in the process `input:` block.
