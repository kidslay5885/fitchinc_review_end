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

const SKIP_NAMES = /^(머니업클래스|핏크닉|괜찮습니다|없습니다|감사합니다|필요없습니다|없음|010)$/i;

function extractName(raw: string): string {
  if (!raw) return "";
  const text = raw.trim();
  const parts = text.split(/[/,.]/).map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    const digitsOnly = part.replace(/[-\s()]/g, "");
    if (/^\d+$/.test(digitsOnly)) continue;

    let cleaned = part
      .replace(/\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, "")
      .replace(/\b\d{10,11}\b/g, "")
      .trim();

    if (SKIP_NAMES.test(cleaned)) continue;
    if (cleaned.length >= 2) return cleaned;
  }

  return "";
}

function extractScore(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  if (!isNaN(n)) return n;
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

// ===== 클라이언트용: 파일 → SurveyResponse[] =====

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

// ===== 서버용: Buffer → SurveyResponse[] =====

export function parseBufferToResponses(
  buffer: ArrayBuffer | Buffer | Uint8Array,
  isPre: boolean
): SurveyResponse[] {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
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

// ===== 서버용: Buffer → 댓글 목록 =====

// 피드백 허브에 가치 있는 텍스트 필드만 추출
// pSat(만족스러운 점) → 키워드성 응답, 이미 만족도 집계에 사용
// pRec(추천 의향) → yes/no 응답, 이미 추천률 수치로 집계
const TEXT_FIELDS = ["hopePlatform", "hopeInstructor", "pFree", "lowScoreReason", "lowFeedbackRequest"] as const;

// 사전 설문 전용 필드
const PRE_FIELDS = new Set(["hopePlatform", "hopeInstructor"]);
// 후기 설문 전용 필드
const POST_FIELDS = new Set(["pFree", "lowScoreReason", "lowFeedbackRequest"]);

// 피드백으로 의미 없는 짧은/일반적 응답 필터
const NOISE_PATTERNS = /^(네|예|아니요|없습니다|없음|감사합니다|고맙습니다|좋습니다|좋았습니다|잘 모르겠습니다|모르겠습니다|특별히 없습니다|딱히 없습니다|아직 없습니다|글쎄요|x|X|-|강의 내용|커리큘럼|피드백|추천합니다|네 추천합니다|예 추천합니다|네 너무 좋습니다|[.\s]*)$/;

export interface ParsedComment {
  respondent: string;
  original_text: string;
  source_field: string;
}

export function parseXLSXToComments(
  buffer: ArrayBuffer | Buffer | Uint8Array,
  isPre: boolean
): ParsedComment[] {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: RowData[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const mapping = mapColumns(headers);
  const comments: ParsedComment[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const get = (field: string) => {
      const col = mapping[field];
      if (!col) return "";
      const v = row[col];
      return v == null ? "" : String(v).trim();
    };

    const rawName = get("name");
    const respondent = extractName(rawName) || `응답자${i + 1}`;

    for (const field of TEXT_FIELDS) {
      if (isPre && !PRE_FIELDS.has(field)) continue;
      if (!isPre && !POST_FIELDS.has(field)) continue;

      const text = get(field);
      if (!text || text.length < 5) continue;
      if (/^[.\s]*$/.test(text) || NOISE_PATTERNS.test(text.trim())) continue;

      comments.push({ respondent, original_text: text, source_field: field });
    }

    const mappedCols = new Set(Object.values(mapping));
    for (const [col, val] of Object.entries(row)) {
      if (mappedCols.has(col)) continue;
      const text = String(val).trim();
      if (text.length >= 20 && !/^\d+$/.test(text)) {
        if (NOISE_PATTERNS.test(text.trim())) continue;
        comments.push({ respondent, original_text: text, source_field: col });
      }
    }
  }

  return comments;
}

export function countRespondents(
  buffer: ArrayBuffer | Buffer | Uint8Array
): number {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: RowData[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows.length;
}
