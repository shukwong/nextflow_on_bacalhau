# Testing with Docker

This project requires **Java 17** to build and test, as mandated by the Nextflow dependencies. If you do not have Java 17 installed locally, or if you are experiencing version conflicts (e.g., with a newer Java version), you can use Docker to run the tests in a clean, isolated environment.

## Prerequisites

*   [Docker](https://www.docker.com/) must be installed and running on your machine.

## Running Tests

Run the following command in the root of the repository to execute the full test suite using the official Gradle Docker image (which includes JDK 17):

```bash
docker run --rm \
    -v "$PWD":/home/gradle/project \
    -w /home/gradle/project \
    gradle:jdk17 \
    gradle test
```

### Command Breakdown

*   `docker run --rm`: Runs a container and automatically removes it after it exits.
*   `-v "$PWD":/home/gradle/project`: Mounts your current working directory (the plugin code) into the container at `/home/gradle/project`.
*   `-w /home/gradle/project`: Sets the working directory inside the container to the mounted project folder.
*   `gradle:jdk17`: Uses the official Docker image for Gradle with Java 17.
*   `gradle test`: The command to execute the standard Gradle test task.

## Troubleshooting

### SSL / Network Issues
If you are running this in a restricted network environment (e.g., behind a corporate proxy), you might encounter SSL handshake errors or timeouts when Gradle attempts to download dependencies from Maven Central.

**Symptoms:**
*   `javax.net.ssl.SSLHandshakeException`
*   `PKIX path building failed`
*   `Could not resolve io.nextflow:nextflow:...`

**Solution:**
Ensure your Docker daemon has access to the internet and that any necessary proxy configurations are passed to the container. You may need to configure Gradle properties within the project or pass environment variables to the Docker container (e.g., `-e HTTP_PROXY=...`).

### Permission Issues (Linux)
On Linux systems, files created by the Docker container (like the `.gradle` cache or `build` directory) might be owned by `root`. To avoid this, you can pass your user ID to the container:

```bash
docker run --rm \
    -u $(id -u):$(id -g) \
    -v "$PWD":/home/gradle/project \
    -w /home/gradle/project \
    gradle:jdk17 \
    gradle test
```

