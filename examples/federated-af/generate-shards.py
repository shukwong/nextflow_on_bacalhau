#!/usr/bin/env python3
"""Generate synthetic multi-sample VCF shards for the federated allele-frequency demo.

Each shard simulates an institution's patient cohort: shared variant sites,
distinct samples. No external data is downloaded — the shards are generated
deterministically from the given seed so results are reproducible.

The shards are deliberately NOT engineered to be federatable in any trivial
way: each contains a full genotype matrix that would normally be considered
identifiable and PHI-protected. The point of the pipeline is that the
genotype matrix never has to leave the node where the shard lives.
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out-dir", required=True, help="Directory to write site VCFs into")
    ap.add_argument("--shards", type=int, default=3, help="Number of sites")
    ap.add_argument("--samples-per-shard", type=int, default=20)
    ap.add_argument("--variants", type=int, default=200)
    ap.add_argument("--chrom", default="chr22")
    ap.add_argument("--start", type=int, default=16_050_000)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # Shared variant sites — same positions across every shard, different genotypes.
    bases = "ACGT"
    sites: list[tuple[int, str, str, float]] = []
    pos = args.start
    for _ in range(args.variants):
        pos += rng.randint(100, 5_000)
        ref = rng.choice(bases)
        alt = rng.choice([b for b in bases if b != ref])
        # Beta(0.5, 2.5) yields a realistic rare-allele-dominated spectrum.
        true_af = rng.betavariate(0.5, 2.5)
        sites.append((pos, ref, alt, true_af))

    for shard in range(args.shards):
        site_id = f"site{chr(ord('A') + shard)}"
        samples = [f"{site_id}_P{i:03d}" for i in range(args.samples_per_shard)]
        path = out_dir / f"{site_id}.vcf"
        with path.open("w") as fh:
            fh.write("##fileformat=VCFv4.2\n")
            fh.write(f"##contig=<ID={args.chrom}>\n")
            fh.write('##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">\n')
            header = [
                "#CHROM", "POS", "ID", "REF", "ALT", "QUAL",
                "FILTER", "INFO", "FORMAT",
            ] + samples
            fh.write("\t".join(header) + "\n")
            for (p, ref, alt, af) in sites:
                gts = []
                for _ in samples:
                    a1 = "1" if rng.random() < af else "0"
                    a2 = "1" if rng.random() < af else "0"
                    gts.append(f"{a1}/{a2}")
                row = [
                    args.chrom, str(p), ".", ref, alt, "100",
                    "PASS", ".", "GT",
                ] + gts
                fh.write("\t".join(row) + "\n")
        print(f"Wrote {path} ({args.samples_per_shard} samples x {args.variants} variants)")


if __name__ == "__main__":
    main()
