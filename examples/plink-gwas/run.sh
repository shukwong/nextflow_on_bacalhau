#!/usr/bin/env bash
#
# Federated PLINK GWAS meta-analysis demo runner.
#
# Generates synthetic PLINK filesets for a few cohorts, stands up a local
# Bacalhau compute node (if needed), runs the Nextflow pipeline, and prints the
# meta-analysis output plus a check that only per-SNP summary statistics — no
# sample-level genotypes or IDs — left each task.
#
# Usage:
#   ./examples/plink-gwas/run.sh [--skip-build] [--skip-bacalhau]
#
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEMO_DIR="${PROJECT_ROOT}/examples/plink-gwas"
PLUGIN_VERSION="0.1.0"
PLUGIN_ID="nf-bacalhau"
PLUGIN_DIR="$HOME/.nextflow/plugins/${PLUGIN_ID}-${PLUGIN_VERSION}"
PLUGIN_JAR="${PROJECT_ROOT}/build/libs/${PLUGIN_ID}-${PLUGIN_VERSION}.jar"

RUN_DIR="${RUN_DIR:-/tmp/nf-bacalhau-plink-gwas}"
DATA_DIR="${RUN_DIR}/data"
OUT_DIR="${RUN_DIR}/results"
BACALHAU_API_PORT="${BACALHAU_API_PORT:-1234}"
BACALHAU_LOG="${RUN_DIR}/bacalhau-server.log"
BACALHAU_PID_FILE="${RUN_DIR}/bacalhau-server.pid"

NEXTFLOW_BIN="${NEXTFLOW_BIN:-nextflow}"
NEXTFLOW_MIN_MAJOR=24
NEXTFLOW_MIN_MINOR=10

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
  fail "Nextflow binary '$NEXTFLOW_BIN' not found. Set NEXTFLOW_BIN (requires Nextflow >=24.10.0)."

# The plugin manifest requires Nextflow >=24.10.0; fail fast with a clear message.
nf_version_raw="$("$NEXTFLOW_BIN" -v 2>&1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1 || true)"
[[ -n "$nf_version_raw" ]] || fail "Could not parse Nextflow version from '$NEXTFLOW_BIN -v'."
nf_major="${nf_version_raw%%.*}"
nf_minor="$(printf '%s' "$nf_version_raw" | cut -d. -f2)"
# Use 10# to force base-10 so a leading zero (e.g. 24.09.x) isn't read as octal.
if (( 10#$nf_major < NEXTFLOW_MIN_MAJOR )) || { (( 10#$nf_major == NEXTFLOW_MIN_MAJOR )) && (( 10#$nf_minor < NEXTFLOW_MIN_MINOR )); }; then
  fail "Nextflow >=${NEXTFLOW_MIN_MAJOR}.${NEXTFLOW_MIN_MINOR}.0 required (plugin manifest), found $nf_version_raw at '$NEXTFLOW_BIN'."
fi

docker info >/dev/null 2>&1 || fail "Docker daemon is not running"

# Autodetect a Java 17 runtime for Nextflow (Nextflow 24.10 runs on Java 17+).
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
command -v java >/dev/null || fail "Java not found — install openjdk@17 or export JAVA_HOME."

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
# Generate synthetic cohorts
# ---------------------------------------------------------------------------
log "Generating synthetic PLINK cohorts under $DATA_DIR"
rm -rf "$DATA_DIR"
python3 "${DEMO_DIR}/generate-plink-data.py" --out-dir "$DATA_DIR"

# ---------------------------------------------------------------------------
# Run the pipeline
# ---------------------------------------------------------------------------
log "Running pipeline (work dir: $RUN_DIR/work)"
cd "$RUN_DIR"
rm -rf work .nextflow* results
"$NEXTFLOW_BIN" run "${DEMO_DIR}/plink-gwas.nf" \
  -c "${DEMO_DIR}/plink-gwas.config" \
  --data_dir "$DATA_DIR" \
  --outdir   "$OUT_DIR"

# ---------------------------------------------------------------------------
# Result + summary-statistics check
# ---------------------------------------------------------------------------
meta="${OUT_DIR}/meta_analysis.meta"
[[ -f "$meta" ]] || fail "Pipeline did not produce $meta"

log "Meta-analysis output (first 10 rows):"
column -t "$meta" 2>/dev/null | head -11 || head -11 "$meta"

log "Summary-statistics check:"
# Per-cohort association files must be per-SNP summaries, never per-sample.
shopt -s nullglob
assoc_files=("$RUN_DIR/work"/*/*/*.assoc.logistic)
[[ ${#assoc_files[@]} -gt 0 ]] || fail "no per-cohort .assoc.logistic files were produced"
printf '  per-cohort association files: %s\n' "${#assoc_files[@]}"

# The synthetic sample IDs look like <cohort>_S<n>. They must NOT appear in any
# output: association files are per-SNP, so a sample ID would mean a leak.
if grep -Eqh '(cohort[A-Z])_S[0-9]+' "${assoc_files[@]}" "$meta" 2>/dev/null; then
  fail "a sample ID leaked into an output file — per-sample data escaped a task"
fi
ok "Outputs contain only per-SNP summary statistics; no sample IDs leaked."

log "Done. See $meta for the combined meta-analysis."
