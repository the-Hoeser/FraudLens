import { FEATURE_COLUMNS, OPTIONAL_COLUMNS } from "@/lib/api/types";

import { parseCsv } from "./parse";

export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
export const MAX_UPLOAD_ROWS = 300_000;
export const MAX_REPORTED_ISSUES = 50;
export const PREVIEW_ROWS = 10;

export interface CsvValidationIssue {
  row: number | null; // 1-based data row (header excluded); null for file-level issues
  column: string | null;
  message: string;
}

export interface CsvValidationResult {
  valid: boolean;
  headers: string[];
  rowCount: number;
  hasLabelColumn: boolean;
  preview: Record<string, string>[];
  errors: CsvValidationIssue[];
  warnings: string[];
  truncatedErrors: boolean;
}

const REQUIRED = new Set<string>(FEATURE_COLUMNS);
const ALLOWED = new Set<string>([...FEATURE_COLUMNS, ...OPTIONAL_COLUMNS]);

/** Mirrors backend/app/services/csv_validation.py. The server re-validates; never trust the client. */
export function validateCsvText(text: string, sizeBytes = text.length): CsvValidationResult {
  const result: CsvValidationResult = {
    valid: false,
    headers: [],
    rowCount: 0,
    hasLabelColumn: false,
    preview: [],
    errors: [],
    warnings: [],
    truncatedErrors: false,
  };
  const push = (issue: CsvValidationIssue) => {
    if (result.errors.length < MAX_REPORTED_ISSUES) result.errors.push(issue);
    else result.truncatedErrors = true;
  };

  if (sizeBytes > MAX_UPLOAD_BYTES) {
    push({ row: null, column: null, message: `File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` });
    return result;
  }

  const rows = parseCsv(text);
  if (rows.length === 0) {
    push({ row: null, column: null, message: "The file is empty." });
    return result;
  }

  const headers = (rows[0] ?? []).map((h) => h.trim());
  result.headers = headers;
  result.hasLabelColumn = headers.includes("Class");

  const seen = new Set<string>();
  for (const h of headers) {
    if (seen.has(h)) push({ row: null, column: h, message: `Duplicate column "${h}".` });
    seen.add(h);
  }
  const missing = [...REQUIRED].filter((c) => !seen.has(c));
  if (missing.length) {
    push({ row: null, column: null, message: `Missing required column(s): ${missing.join(", ")}.` });
  }
  const unexpected = headers.filter((h) => !ALLOWED.has(h));
  if (unexpected.length) {
    push({
      row: null,
      column: null,
      message: `Unexpected column(s): ${unexpected.join(", ")}. Only the anonymized feature schema is accepted — remove any personal or payment data.`,
    });
  }

  const dataRows = rows.slice(1);
  result.rowCount = dataRows.length;
  if (dataRows.length === 0) push({ row: null, column: null, message: "The file has a header but no data rows." });
  if (dataRows.length > MAX_UPLOAD_ROWS) {
    push({ row: null, column: null, message: `Too many rows (${dataRows.length}). The limit is ${MAX_UPLOAD_ROWS}.` });
  }
  if (result.errors.length > 0) return result;

  dataRows.forEach((cells, idx) => {
    const rowNo = idx + 1;
    if (cells.length !== headers.length) {
      push({ row: rowNo, column: null, message: `Expected ${headers.length} values, found ${cells.length}.` });
      return;
    }
    headers.forEach((h, c) => {
      const raw = (cells[c] ?? "").trim();
      if (raw === "") {
        push({ row: rowNo, column: h, message: "Missing value." });
        return;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        push({ row: rowNo, column: h, message: `"${raw.slice(0, 24)}" is not a finite number.` });
        return;
      }
      if ((h === "Time" || h === "Amount") && n < 0) push({ row: rowNo, column: h, message: "Must be ≥ 0." });
      if (h === "Class" && n !== 0 && n !== 1) push({ row: rowNo, column: h, message: "Class must be 0 or 1." });
    });
    if (idx < PREVIEW_ROWS) {
      result.preview.push(Object.fromEntries(headers.map((h, c) => [h, cells[c] ?? ""])));
    }
  });

  if (result.hasLabelColumn) {
    result.warnings.push(
      "A Class column is present. It is ignored for prediction (to avoid label leakage) and only kept for offline comparison.",
    );
  }
  result.valid = result.errors.length === 0;
  return result;
}

/** Add to src/lib/csv/schema.ts. Uses streaming chunks so large files are not loaded as one string. */
export async function validateCsvFile(file: File): Promise<CsvValidationResult> {
  const result: CsvValidationResult = {
    valid: false, headers: [], rowCount: 0, hasLabelColumn: false,
    preview: [], errors: [], warnings: [], truncatedErrors: false,
  };
  const push = (issue: CsvValidationIssue) => {
    if (result.errors.length < MAX_REPORTED_ISSUES) result.errors.push(issue);
    else result.truncatedErrors = true;
  };

  if (file.size > MAX_UPLOAD_BYTES) {
    push({ row: null, column: null, message: `File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MiB.` });
    return result;
  }
  if (!file.size) {
    push({ row: null, column: null, message: "The file is empty." });
    return result;
  }

  const reader = file.stream().getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  let headers: string[] | null = null;
  let dataRow = 0;

  const processLine = (rawLine: string) => {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim()) return;
    const cells = parseCsv(line)[0] ?? [];

    if (headers === null) {
      headers = cells.map((cell) => cell.trim().replace(/^\uFEFF/, ""));
      result.headers = headers;
      result.hasLabelColumn = headers.includes("Class");
      const seen = new Set<string>();
      for (const header of headers) {
        if (seen.has(header)) push({ row: null, column: header, message: `Duplicate column "${header}".` });
        seen.add(header);
      }
      const missing = [...REQUIRED].filter((column) => !seen.has(column));
      if (missing.length) push({ row: null, column: null, message: `Missing required column(s): ${missing.join(", ")}.` });
      const unexpected = headers.filter((header) => !ALLOWED.has(header));
      if (unexpected.length) push({ row: null, column: null, message: `Unexpected column(s): ${unexpected.join(", ")}. Remove personal or payment data.` });
      return;
    }

    dataRow += 1;
    result.rowCount = dataRow;
    if (dataRow > MAX_UPLOAD_ROWS) {
      push({ row: null, column: null, message: `Too many rows. The limit is ${MAX_UPLOAD_ROWS.toLocaleString()}.` });
      return;
    }
    if (cells.length !== headers.length) {
      push({ row: dataRow, column: null, message: `Expected ${headers.length} values, found ${cells.length}.` });
      return;
    }

    const previewRow: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      const raw = (cells[columnIndex] ?? "").trim();
      previewRow[header] = raw;
      const value = Number(raw);
      if (raw === "" || !Number.isFinite(value)) {
        push({ row: dataRow, column: header, message: "Missing, non-numeric, or non-finite value." });
      } else if ((header === "Time" || header === "Amount") && value < 0) {
        push({ row: dataRow, column: header, message: "Must be ≥ 0." });
      } else if (header === "Class" && value !== 0 && value !== 1) {
        push({ row: dataRow, column: header, message: "Class must be 0 or 1." });
      }
    });
    if (result.preview.length < PREVIEW_ROWS) result.preview.push(previewRow);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) processLine(line);
      if (result.rowCount > MAX_UPLOAD_ROWS || result.errors.length >= MAX_REPORTED_ISSUES) break;
    }
    pending += decoder.decode();
    if (pending) processLine(pending);
  } catch {
    push({ row: null, column: null, message: "Could not decode the CSV as UTF-8." });
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  if (headers === null) push({ row: null, column: null, message: "The file is empty or has no header row." });
  else if (dataRow === 0) push({ row: null, column: null, message: "The file has a header but no data rows." });
  if (result.hasLabelColumn) {
    result.warnings.push("Class is ignored for prediction (to prevent label leakage) and retained only for offline comparison.");
  }
  result.valid = result.errors.length === 0;
  return result;
}
