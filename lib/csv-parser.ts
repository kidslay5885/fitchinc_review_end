import * as XLSX from "xlsx";
import { COLUMN_PATTERNS } from "./constants";
import type { SurveyResponse } from "./types";
import { generateId } from "./types";

type RowData = Record<string, string>;

function mapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const trimmed = header.trim();
    if (!trimmed) continue;

    for (const [field, pattern] of Object.entries(COLUMN_PATTERNS)) {
      if (pattern.test(trimmed) && !mapping[field]) {
        mapping[field] = header;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Extract a clean name from potentially combined "성함 및 연락처" field.
 * Real data formats:
 *   "정성제/010-4177-4713"  → 정성제
 *   "01041233996/박지연"    → 박지연
 *   "김주리. 01022918533"   → 김주리
 *   "최철희 01058230438"    → 최철희
 *   "010-9246-9669"         → "" (phone only)
 *   "괜찮습니다"             → "" (irrelevant text)
 */
const SKIP_NAMES = /^(머니업클래스|핏크닉|괜찮습니다|없습니다|감사합니다|필요없습니다|없음|010)$/i;

function extractName(raw: string): string {
  if (!raw) return "";
  const text = raw.trim();

  // Split by / , . separators
  const parts = text.split(/[/,.]/).map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    // Skip if the part is all digits (phone number)
    const digitsOnly = part.replace(/[-\s()]/g, "");
    if (/^\d+$/.test(digitsOnly)) continue;

    // Remove embedded phone numbers
    let cleaned = part
      .replace(/\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, "")
      .replace(/\b\d{10,11}\b/g, "")
      .trim();

    // Skip known non-name text
    if (SKIP_NAMES.test(cleaned)) continue;

    if (cleaned.length >= 2) return cleaned;
  }

  return "";
}

/**
 * Extract a numeric score from text like "8", "8점", "10/10", "5 - 매우 그렇다"
 */
function extractScore(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  if (!isNaN(n)) return n;
  // Try extracting first number from text
  const m = raw.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function parseRow(
  row: RowData,
  mapping: Record<string, string>,
  isPre: boolean,
  index: number
): SurveyResponse {
  const get = (field: string) => {
    const col = mapping[field];
    if (!col) return "";
    const v = row[col];
    return v == null ? "" : String(v).trim();
  };

  const rawData: Record<string, string> = {};
  const mappedCols = new Set(Object.values(mapping));
  for (const [k, v] of Object.entries(row)) {
    if (!mappedCols.has(k) && v != null) {
      const s = String(v).trim();
      if (s) rawData[k] = s;
    }
  }

  // Name extraction: pre surveys have dedicated name column,
  // post surveys use 커피쿠폰 성함+연락처 field (mapped via 성함 pattern)
  const rawName = get("name");
  const cleanName = extractName(rawName);

  return {
    id: generateId(),
    name: cleanName || `응답자${index + 1}`,
    gender: get("gender"),
    age: get("age"),
    job: get("job"),
    hours: get("hours"),
    channel: get("channel"),
    computer: extractScore(get("computer")),
    goal: get("goal"),
    hopePlatform: get("hopePlatform"),
    hopeInstructor: get("hopeInstructor"),
    ps1: isPre ? 0 : extractScore(get("ps1")),
    ps2: isPre ? 0 : extractScore(get("ps2")),
    pSat: isPre ? "" : get("pSat"),
    pFmt: isPre ? "" : get("pFmt"),
    pFree: isPre ? "" : get("pFree"),
    pRec: isPre ? "" : get("pRec"),
    rawData,
  };
}

export async function parseXLSX(
  file: File,
  isPre: boolean
): Promise<SurveyResponse[]> {
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: RowData[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const mapping = mapColumns(headers);

  return rows
    .map((row, i) => parseRow(row, mapping, isPre, i))
    .filter((r) => r.name !== "");
}
