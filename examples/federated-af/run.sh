#!/usr/bin/env bash
#
# Federated allele-frequency demo runner.
#
# Generates 3 synthetic VCF shards, stands up a local Bacalhau compute node
# (if needed), runs the Nextflow pipeline, and prints the pooled AF table
# plus a privacy-invariant check that proves no genotypes or sample IDs
# left the shards.
#
# Usage:
#   ./examples/federated-af/run.sh [--skip-build] [--skip-bacalhau]
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEMO_DIR="${PROJECT_ROOT}/examples/federated-af"
PLUGIN_VERSION="0.1.0-SNAPSHOT"
PLUGIN_ID="nf-bacalhau"
PLUGIN_DIR="$HOME/.nextflow/plugins/${PLUGIN_ID}-${PLUGIN_VERSION}"
PLUGIN_JAR="${PROJECT_ROOT}/build/libs/${PLUGIN_ID}-${PLUGIN_VERSION}.jar"

RUN_DIR="${RUN_DIR:-/tmp/nf-bacalhau-federated-af}"
SHARDS_DIR="${RUN_DIR}/shards"
OUT_DIR="${RUN_DIR}/out"
BACALHAU_API_PORT="${BACALHAU_API_PORT:-1234}"
BACALHAU_LOG="${RUN_DIR}/bacalhau-server.log"
BACALHAU_PID_FILE="${RUN_DIR}/bacalhau-server.pid"

NEXTFLOW_BIN="${NEXTFLOW_BIN:-nextflow23}"

SKIP_BUILD=false
SKIP_BACALHAU=false
for arg in "$@"; do
  case "$arg" in
    --skip-build)    SKIP_BUILD=true ;;
    --skip-bacalhau) SKIP_BACALHAU=true ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '\033[1;34m[run]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ok]\033[0m  %s\n' "$*"; }
fail() { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------
log "Checking prerequisites"
command -v docker   >/dev/null || fail "docker CLI not found"
command -v bacalhau >/dev/null || fail "bacalhau CLI not found"
command -v python3  >/dev/null || fail "python3 not found"
command -v "$NEXTFLOW_BIN" >/dev/null || \
  fail "Nextflow 23.10.x binary '$NEXTFLOW_BIN' not found. Set NEXTFLOW_BIN."
docker info >/dev/null 2>&1 || fail "Docker daemon is not running"

# Autodetect Java 17 for Nextflow.
if [[ -z "${JAVA_HOME:-}" ]] || [[ ! -x "${JAVA_HOME}/bin/java" ]]; then
  for candidate in \
      /opt/homebrew/opt/openjdk@17 \
      /usr/local/opt/openjdk@17 \
      "$(/usr/libexec/java_home -v 17 2>/dev/null || true)"; do
    if [[ -n "$candidate" && -x "$candidate/bin/java" ]]; then
      export JAVA_HOME="$candidate"
      export PATH="$JAVA_HOME/bin:$PATH"
      break
    fi
  done
fi
command -v java >/dev/null || fail "Java 17 not found — install openjdk@17 or export JAVA_HOME."

mkdir -p "$RUN_DIR"

# ---------------------------------------------------------------------------
# Build + stage plugin
# ---------------------------------------------------------------------------
if ! $SKIP_BUILD; then
  log "Building plugin (./gradlew assemble)"
  (cd "$PROJECT_ROOT" && ./gradlew --quiet assemble)
fi
[[ -f "$PLUGIN_JAR" ]] || fail "Plugin JAR not found at $PLUGIN_JAR — run without --skip-build."

log "Staging plugin to $PLUGIN_DIR"
rm -rf "$PLUGIN_DIR"
mkdir -p "$PLUGIN_DIR/classes" "$PLUGIN_DIR/lib"
cp "$PLUGIN_JAR" "$PLUGIN_DIR/lib/"
(cd "$PLUGIN_DIR/classes" && unzip -oq "$PLUGIN_JAR")

# ---------------------------------------------------------------------------
# Local Bacalhau compute node
# ---------------------------------------------------------------------------
is_bacalhau_up() {
  curl -fsS "http://localhost:${BACALHAU_API_PORT}/api/v1/agent/alive" >/dev/null 2>&1
}

if ! $SKIP_BACALHAU; then
  if is_bacalhau_up; then
    log "Bacalhau node already running on :${BACALHAU_API_PORT}"
  else
    log "Starting local Bacalhau node (log: $BACALHAU_LOG)"
    nohup bacalhau serve \
      --orchestrator \
      --compute \
      --name=local-node \
      -c "API.Port=${BACALHAU_API_PORT}" \
      -c "Compute.AllowListedLocalPaths=/tmp/**:rw,/private/tmp/**:rw" \
      >"$BACALHAU_LOG" 2>&1 &
    echo $! > "$BACALHAU_PID_FILE"
    for _ in $(seq 1 30); do
      is_bacalhau_up && break
      sleep 1
    done
    is_bacalhau_up || { tail -40 "$BACALHAU_LOG"; fail "Bacalhau failed to come up"; }
    ok "Bacalhau node ready (pid $(cat "$BACALHAU_PID_FILE"))"
  fi
fi

# ---------------------------------------------------------------------------
# Generate synthetic shards
# ---------------------------------------------------------------------------
log "Generating 3 synthetic shards under $SHARDS_DIR"
rm -rf "$SHARDS_DIR"
python3 "${DEMO_DIR}/generate-shards.py" --out-dir "$SHARDS_DIR"

# ---------------------------------------------------------------------------
# Run the pipeline
# ---------------------------------------------------------------------------
log "Running pipeline (work dir: $RUN_DIR/work)"
cd "$RUN_DIR"
rm -rf work .nextflow* out
"$NEXTFLOW_BIN" run "${DEMO_DIR}/main.nf" \
  -c "${DEMO_DIR}/nextflow.config" \
  --shards_dir "$SHARDS_DIR" \
  --out_dir    "$OUT_DIR"

# ---------------------------------------------------------------------------
# Result + privacy-invariant check
# ---------------------------------------------------------------------------
pooled="${OUT_DIR}/pooled_af.tsv"
[[ -f "$pooled" ]] || fail "Pipeline did not produce $pooled"

log "Pooled allele-frequency table (first 10 rows):"
column -t -s $'\t' "$pooled" | head -11

log "Privacy-invariant check:"
# Input shard: should have 9 fixed cols + 20 sample cols = 29.
shard_ncol=$(awk '/^#CHROM/ {print NF; exit}' "$SHARDS_DIR/siteA.vcf")
printf '  shard VCF columns:       %s  (9 fixed + 20 samples)\n' "$shard_ncol"

# Per-shard count file: MUST be 6 columns, no genotypes.
counts_ncol=$(awk 'NR==1 {print NF; exit}' "$RUN_DIR/work"/*/*/*.counts.tsv 2>/dev/null | head -1)
printf '  per-shard counts cols:   %s  (expect 6)\n' "$counts_ncol"

# Pooled TSV: MUST be 7 columns, no sample IDs.
pooled_ncol=$(awk 'NR==1 {print NF; exit}' "$pooled")
printf '  pooled TSV columns:      %s  (expect 7)\n' "$pooled_ncol"

if [[ "$counts_ncol" != "6" ]]; then
  fail "per-shard counts has the wrong number of columns — genotypes may have leaked"
fi
if [[ "$pooled_ncol" != "7" ]]; then
  fail "pooled TSV has the wrong number of columns — genotypes may have leaked"
fi
if grep -Eq 'site[A-Z]_P[0-9]' "$pooled" "$RUN_DIR/work"/*/*/*.counts.tsv 2>/dev/null; then
  fail "sample IDs leaked into an output file"
fi
ok "No genotype columns or sample IDs left any shard. Federation invariant holds."

log "Done. See $pooled for the full table."
