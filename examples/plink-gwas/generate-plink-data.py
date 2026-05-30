#!/usr/bin/env python3
"""Generate synthetic PLINK text filesets for the federated GWAS demo.

For each cohort this writes three plain-text files (no PLINK install needed):

  <cohort>.ped  - FID IID PAT MAT SEX PHENO  then one allele pair per SNP
  <cohort>.map  - CHR  SNP  cM  BP           one line per SNP
  <cohort>.cov  - FID IID C1 C2              numeric covariates (header row)

All cohorts SHARE the same variant definition (SNP IDs, chromosome, and
positions) so that PLINK's meta-analysis — which keys on SNP ID — combines
like-for-like variants. Only the genotypes, phenotypes, and covariates vary
per cohort. The data is random but deterministic (seeded), with polymorphic
SNPs and a balanced case/control phenotype, so `plink --logistic` produces
non-degenerate results on every cohort. It is NOT biologically meaningful — it
only exercises the pipeline end to end, the same way
examples/federated-af/generate-shards.py produces synthetic VCFs.
"""
from __future__ import annotations

import argparse
import os
import random


def build_variants(n_snps: int, seed: int) -> tuple[list[int], list[float]]:
    """Build the shared variant map: ascending positions + per-SNP MAF.

    Generated once and reused for every cohort, so rs<i> means the same locus
    everywhere (a hard requirement for SNP-ID-keyed meta-analysis).
    """
    rng = random.Random(seed)
    positions: list[int] = []
    freqs: list[float] = []
    bp = 1_000_000
    for _ in range(n_snps):
        bp += rng.randint(200, 2000)
        positions.append(bp)
        freqs.append(rng.uniform(0.1, 0.45))  # keep SNPs polymorphic
    return positions, freqs


def write_map(out_dir: str, name: str, positions: list[int]) -> None:
    with open(os.path.join(out_dir, f"{name}.map"), "w") as fh:
        for i, pos in enumerate(positions):
            fh.write(f"22\trs{i+1}\t0\t{pos}\n")


def write_cohort(
    out_dir: str,
    name: str,
    n_samples: int,
    positions: list[int],
    freqs: list[float],
    seed: int,
) -> None:
    rng = random.Random(seed)

    # Shared variant map (same IDs/positions/alleles across all cohorts).
    write_map(out_dir, name, positions)

    # --- samples (.ped) -----------------------------------------------------
    ped_path = os.path.join(out_dir, f"{name}.ped")
    cov_rows = []
    with open(ped_path, "w") as fh:
        for s in range(n_samples):
            fid = f"{name}_FAM{s+1}"
            iid = f"{name}_S{s+1}"
            sex = rng.choice((1, 2))
            pheno = rng.choice((1, 2))  # 1 = control, 2 = case (balanced)

            genos = []
            for p in freqs:
                # minor-allele count under Hardy-Weinberg (A = major, C = minor)
                minor = sum(1 for _ in range(2) if rng.random() < p)
                if minor == 0:
                    genos.append("A A")
                elif minor == 1:
                    genos.append("A C")
                else:
                    genos.append("C C")

            fh.write(f"{fid} {iid} 0 0 {sex} {pheno} " + " ".join(genos) + "\n")

            # two numeric covariates: a standardized PC-like value and an age.
            c1 = round(rng.gauss(0, 1), 4)
            c2 = rng.randint(30, 80)
            cov_rows.append((fid, iid, c1, c2))

    # --- covariates (.cov) --------------------------------------------------
    cov_path = os.path.join(out_dir, f"{name}.cov")
    with open(cov_path, "w") as fh:
        fh.write("FID IID C1 C2\n")
        for fid, iid, c1, c2 in cov_rows:
            fh.write(f"{fid} {iid} {c1} {c2}\n")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out-dir", required=True, help="directory to write filesets into")
    ap.add_argument("--cohorts", type=int, default=3, help="number of cohorts (default 3)")
    ap.add_argument("--samples", type=int, default=150, help="samples per cohort (default 150)")
    ap.add_argument("--snps", type=int, default=500, help="SNPs per cohort (default 500)")
    ap.add_argument("--seed", type=int, default=42, help="base RNG seed (default 42)")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    # One shared variant definition for every cohort.
    positions, freqs = build_variants(args.snps, args.seed)

    names = [f"cohort{chr(ord('A') + i)}" for i in range(args.cohorts)]
    for i, name in enumerate(names):
        # Genotypes/phenotypes/covariates vary per cohort; the map does not.
        write_cohort(args.out_dir, name, args.samples, positions, freqs, args.seed + 1000 + i)
        print(f"wrote {name}: {args.samples} samples x {args.snps} SNPs -> {args.out_dir}/{name}.{{ped,map,cov}}")


if __name__ == "__main__":
    main()
