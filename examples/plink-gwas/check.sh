#!/usr/bin/env bash
#
# Reproducibility + privacy gate for the federated PLINK GWAS example.
#
# Asserts the claims the example makes about its output — the same checks the
# (now retired) Gradle/Spock integration test made, but as a portable shell gate
# this research repo can run without a JVM build. run.sh calls this after the
# pipeline; CI can call it too.
#
# Usage: check.sh <meta_analysis.meta> <work_dir>
#   <meta_analysis.meta>  the published meta-analysis table
#   <work_dir>            Nextflow work dir (scanned for per-cohort .assoc.logistic)
#
# Env: COHORTS (default 3) — must match generate-plink-data.py --cohorts.
#
set -euo pipefail

META="${1:?usage: check.sh <meta_analysis.meta> <work_dir>}"
WORK="${2:?usage: check.sh <meta_analysis.meta> <work_dir>}"
COHORTS="${COHORTS:-3}"
SAMPLE_ID_RE='cohort[A-Z]_(S|FAM)[0-9]+'   # synthetic per-sample IDs; a leak if present in any output

fail() { printf '\033[1;31m[check:fail]\033[0m %s\n' "$*" >&2; exit 1; }
ok()   { printf '\033[1;32m[check:ok]\033[0m   %s\n' "$*"; }

# 1. published and non-empty
[[ -s "$META" ]] || fail "meta-analysis missing or empty: $META"

# 2. schema: stable PLINK meta columns present, plus an effect column
header="$(head -1 "$META")"
for col in CHR BP SNP A1 N P; do
  grep -qwE "$col" <<<"$header" || fail "meta header missing column '$col': $header"
done
grep -qwE 'OR|BETA' <<<"$header" || fail "meta header has no effect column (OR/BETA): $header"
ncol="$(awk '{for(i=1;i<=NF;i++) if($i=="N"){print i; exit}}' <<<"$header")"
[[ -n "$ncol" ]] || fail "could not locate the N column"
ok "schema: $header"

# 3. rows: 1..500 combined SNPs; every N in 1..COHORTS; max N == COHORTS;
#    majority of SNPs pooled across all cohorts (proves the cross-cohort combine ran)
rows="$(($(wc -l < "$META") - 1))"
(( rows >= 1 && rows <= 500 )) || fail "unexpected combined-SNP count: $rows (want 1..500)"
read -r maxN fullN total badN < <(awk -v c="$ncol" -v K="$COHORTS" '
  NR>1 { n=$c+0; if(n<1||n>K)bad++; if(n>mx)mx=n; if(n==K)full++; tot++ }
  END  { printf "%d %d %d %d\n", mx, full, tot, bad+0 }' "$META")
(( badN == 0 ))          || fail "$badN SNP(s) have N outside 1..$COHORTS"
(( maxN == COHORTS ))    || fail "max N is $maxN, expected $COHORTS (cross-cohort combine did not run)"
(( fullN * 2 > total ))  || fail "only $fullN/$total SNPs pooled across all cohorts (expected a majority)"
ok "pooled across cohorts: $fullN/$total SNPs at N=$COHORTS (combined SNPs: $rows)"

# 4. privacy invariant: no sample-level identifier in the meta OR any per-cohort output
shopt -s nullglob
assoc=("$WORK"/*/*/*.assoc.logistic)
(( ${#assoc[@]} >= COHORTS )) || fail "expected >= $COHORTS per-cohort .assoc.logistic files, found ${#assoc[@]}"
if grep -EqhI "$SAMPLE_ID_RE" "$META" "${assoc[@]}"; then
  fail "a sample-level identifier leaked into an output file — per-sample data escaped a task"
fi
ok "no sample-level identifier in any output (${#assoc[@]} cohort files + meta)"

ok "plink-gwas reproducibility + privacy checks passed"
