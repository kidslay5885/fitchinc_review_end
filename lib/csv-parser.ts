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

    const cleaned = part
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

  // SurveyResponse 객체에서 실제로 사용하는 필드만 rawData에서 제외
  // selectReason, prevCourse, expectedBenefit 등은 SurveyResponse에 없으므로
  // rawData에 남겨야 computeDemographics()에서 추출 가능
  const RESPONSE_FIELDS = new Set([
    "name", "gender", "age", "job", "hours", "channel", "computer", "goal",
    "hopePlatform", "hopeInstructor", "ps1", "ps2", "pSat", "pFmt", "pFree", "pRec",
  ]);
  const rawData: Record<string, string> = {};
  const usedCols = new Set(
    Object.entries(mapping)
      .filter(([field]) => RESPONSE_FIELDS.has(field))
      .map(([, col]) => col)
  );
  for (const [k, v] of Object.entries(row)) {
    if (!usedCols.has(k) && v != null) {
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

// 세부 분류 대상 문항
const TEXT_FIELDS = [
  "selectReason", "hopePlatform", "hopeInstructor",
  "satOther", "lowScoreReason", "lowFeedbackRequest", "pFree", "pRec",
  "prevCourse", "prevExperience", "expectedBenefit",
] as const;

// 사전 설문 전용 필드
const PRE_FIELDS = new Set(["selectReason", "hopePlatform", "hopeInstructor", "prevCourse", "prevExperience", "expectedBenefit"]);
// 후기 설문 전용 필드
const POST_FIELDS = new Set(["satOther", "lowScoreReason", "lowFeedbackRequest", "pFree", "pRec"]);

// 피드백으로 의미 없는 짧은/일반적 응답 필터
const NOISE_PATTERNS = /^(네|예|아니요|없습니다|없음|감사합니다|고맙습니다|좋습니다|좋았습니다|잘 모르겠습니다|모르겠습니다|잘 모르겠어요|특별히 없습니다|딱히 없습니다|아직 없습니다|아직 없어요|별로 없습니다|별로 없어요|글쎄요|x|X|-|강의 내용|커리큘럼|피드백|추천합니다|네 추천합니다|예 추천합니다|네 너무 좋습니다|없어요|특별한 건 없습니다|특별한 건 없어요|없는 것 같습니다|없는 것 같아요|생각이 안 납니다|생각이 안 나요|[.\s]*)$/;

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
