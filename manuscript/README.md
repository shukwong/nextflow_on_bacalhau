# Applications Note Manuscript

This directory contains the draft applications note for **nf-bacalhau**,
targeting a bioinformatics applications-note venue (Bioinformatics, JOSS,
F1000Research) anchored on the federated allele-frequency demo.

## Files

- `applications-note.md` — Pandoc Markdown with YAML front matter
- `refs.bib` — BibTeX bibliography

## Render

With [Pandoc](https://pandoc.org) and a LaTeX toolchain installed:

```bash
# PDF (requires pdflatex or xelatex)
pandoc manuscript/applications-note.md \
  --citeproc \
  --from markdown \
  --to pdf \
  --output manuscript/applications-note.pdf

# DOCX
pandoc manuscript/applications-note.md \
  --citeproc \
  --from markdown \
  --to docx \
  --reference-doc templates/bioinformatics.docx \
  --output manuscript/applications-note.docx
```

The `--citeproc` flag resolves the `[@key]` references against `refs.bib`
using the CSL style declared in the YAML header.

## Target venue

- **Primary**: *Bioinformatics* Applications Note (≤ 2 printed pages,
  ~1500 words, brief abstract, emphasis on novelty of software contribution).
- **Alternate**: *Journal of Open Source Software* (software paper format,
  requires Open Review repository).
- **Secondary**: *F1000Research Bioinformatics Gateway* (longer
  applications-note format with post-publication peer review).

## Status

Draft. Needs:

- [ ] Author affiliation + ORCID
- [ ] Funding statement
- [ ] Benchmark comparison against Slurm or AWS Batch for a standard
      genomics workload (planned for Phase 4)
- [ ] Multi-node Bacalhau cluster execution of the federated demo
- [ ] Figure 1: plugin architecture diagram
- [ ] Figure 2: federated-AF pipeline DAG + data-movement overlay
- [ ] Final word-count pass for Bioinformatics applications-note budget
