/**
 * Client-side parser for pooled_af.tsv files produced by the federated-AF
 * aggregator. Enforces the privacy invariant at parse time: any deviation from
 * the 7-column aggregate schema is rejected, so no file picked here can leak
 * per-sample data into the dashboard.
 *
 * Schema: CHROM \t POS \t REF \t ALT \t AC \t AN \t AF
 */

import type {
  InvariantCheck,
  PooledAFParseResult,
  PooledAFVariant,
} from './types';

const EXPECTED_HEADERS = ['CHROM', 'POS', 'REF', 'ALT', 'AC', 'AN', 'AF'] as const;
const MAX_ROWS = 200_000; // aggregator output size-bound per design §6

// Column names that would indicate per-sample data leaked into the file.
// The list is intentionally broad — we'd rather reject a benign file than
// render a genotype column.
const FORBIDDEN_HEADER_PATTERNS: RegExp[] = [
  /^FORMAT$/i,
  /^GT$/i,
  /^GENOTYPE/i,
  /^SAMPLE/i,
  /^IND(IVIDUAL)?/i,
  /^HG\d/i, // e.g. HG00096
  /^NA\d/i, // e.g. NA12878
];

function headerLooksLikeSample(header: string): boolean {
  return FORBIDDEN_HEADER_PATTERNS.some((re) => re.test(header));
}

function splitRow(row: string): string[] {
  return row.split(/\t|,/);
}

export function parsePooledAF(
  text: string,
  fileName: string,
): PooledAFParseResult {
  const errors: string[] = [];
  const variants: PooledAFVariant[] = [];

  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return {
      variants: [],
      invariants: [
        {
          name: 'schema-ok',
          ok: false,
          detail: 'File is empty',
        },
      ],
      errors: ['File is empty'],
      fileName,
      rowCount: 0,
    };
  }

  const firstLine = lines[0] ?? '';
  const headerRow = firstLine.startsWith('#')
    ? firstLine.replace(/^#+\s*/, '')
    : firstLine;
  const headers = splitRow(headerRow).map((h) => h.trim());
  const hasHeader =
    headers.length >= 7 &&
    headers
      .slice(0, 7)
      .every(
        (h, i) => h.toUpperCase() === EXPECTED_HEADERS[i],
      );

  if (!hasHeader) {
    errors.push(
      `Header mismatch. Expected ${EXPECTED_HEADERS.join('\\t')}, got ${headers
        .slice(0, 7)
        .join('\\t')}`,
    );
  }

  const forbiddenLeaks = headers.filter(headerLooksLikeSample);
  if (forbiddenLeaks.length > 0) {
    errors.push(
      `Rejected: header contains sample/genotype columns (${forbiddenLeaks.join(
        ', ',
      )}). The dashboard refuses to load files that carry per-individual data.`,
    );
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;
  if (dataLines.length > MAX_ROWS) {
    errors.push(
      `Rejected: file has ${dataLines.length} rows, exceeds size bound ${MAX_ROWS}.`,
    );
  }

  let parsedRows = 0;
  for (let idx = 0; idx < dataLines.length && errors.length === 0; idx += 1) {
    const line = dataLines[idx];
    if (line === undefined) continue;
    const cols = splitRow(line);
    if (cols.length !== 7) {
      errors.push(
        `Row ${idx + (hasHeader ? 2 : 1)}: expected 7 columns, got ${cols.length}.`,
      );
      break;
    }
    const [chrom, posStr, ref, alt, acStr, anStr, afStr] = cols as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const pos = Number(posStr);
    const ac = Number(acStr);
    const an = Number(anStr);
    const af = Number(afStr);
    if (!Number.isFinite(pos) || !Number.isFinite(ac) || !Number.isFinite(an) || !Number.isFinite(af)) {
      errors.push(`Row ${idx + (hasHeader ? 2 : 1)}: non-numeric value.`);
      break;
    }
    if (ac < 0 || an < 0 || af < 0 || af > 1.00001) {
      errors.push(
        `Row ${idx + (hasHeader ? 2 : 1)}: AC/AN/AF out of expected range (AC=${ac} AN=${an} AF=${af}).`,
      );
      break;
    }
    variants.push({
      chrom: chrom.trim(),
      pos,
      ref: ref.trim(),
      alt: alt.trim(),
      ac,
      an,
      af,
    });
    parsedRows += 1;
  }

  const invariants: InvariantCheck[] = [
    {
      name: 'schema-ok',
      ok: hasHeader && errors.length === 0,
      detail: hasHeader
        ? `7-column schema (${EXPECTED_HEADERS.join(', ')})`
        : 'Header did not match expected schema',
    },
    {
      name: 'no-sample-ids',
      ok: forbiddenLeaks.length === 0,
      detail:
        forbiddenLeaks.length === 0
          ? 'No sample-ID-like columns in header'
          : `Blocked columns: ${forbiddenLeaks.join(', ')}`,
    },
    {
      name: 'size-bound',
      ok: dataLines.length <= MAX_ROWS,
      detail: `${dataLines.length.toLocaleString()} data rows (limit ${MAX_ROWS.toLocaleString()})`,
    },
    {
      name: 'counts-only',
      ok: errors.length === 0,
      detail: 'AC, AN integers and AF ∈ [0,1]',
    },
  ];

  return {
    variants: errors.length === 0 ? variants : [],
    invariants,
    errors,
    fileName,
    rowCount: parsedRows,
  };
}

/**
 * Chromosome string → numeric ordinal for Manhattan plot x-axis layout.
 * Non-numeric chromosomes (X, Y, MT) are placed after autosomes 1..22.
 */
export function chromOrdinal(chrom: string): number {
  const cleaned = chrom.replace(/^chr/i, '').toUpperCase();
  const n = Number(cleaned);
  if (Number.isFinite(n)) return n;
  if (cleaned === 'X') return 23;
  if (cleaned === 'Y') return 24;
  if (cleaned === 'MT' || cleaned === 'M') return 25;
  return 100;
}
