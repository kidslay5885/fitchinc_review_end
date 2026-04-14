"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import type { Instructor, Course, Cohort, SurveyResponse } from "@/lib/types";
import { allCohorts } from "@/lib/types";
import {
  computeDemographics,
  computeScores,
  getSatisfactionItems,
  extractFromRawData,
  RAW_DATA_PATTERNS,
  collectExtraQuestions,
  collectAllQuestions,
} from "@/lib/analysis-engine";
import { ChevronDown, ChevronUp, ClipboardList, X } from "lucide-react";
import { toast } from "sonner";
import { RingScore } from "@/components/ring-score";
import { ErrorBoundary } from "@/components/error-boundary";
import { getAppSettings } from "@/lib/app-settings-cache";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ---- colours ----
const PIE_COLORS = ["#3451B2", "#E5484D", "#46A758", "#F76B15", "#6E56CF", "#30A46C", "#E093D3", "#889096"];
const BAR_COLOR = "#3451B2";

// 성별 고정 색상
const GENDER_COLOR_MAP: Record<string, string> = { "여성": "#E5484D", "남성": "#3451B2" };

// ---- helpers ----

/** 라벨에서 첫 번째 숫자를 추출해 정렬 키로 사용 */
function labelSortKey(label: string): number {
  const m = label.match(/\d+/);
  if (!m) return Infinity;
  let n = parseInt(m[0]);
  if (label.includes("미만") || label.includes("이하")) n -= 0.5;
  if (label.includes("이상") || label.includes("초과")) n += 0.5;
  return n;
}

/** 라벨의 자연 순서(숫자 → 한국어)로 정렬된 차트 데이터 */
export function toChartData(record: Record<string, number>) {
  return Object.entries(record)
    .filter(([, v]) => v > 0)
    .sort((a, b) => {
      const ka = labelSortKey(a[0]);
      const kb = labelSortKey(b[0]);
      if (ka !== kb) return ka - kb;
      return a[0].localeCompare(b[0], "ko");
    })
    .map(([name, value]) => ({ name, value }));
}

/** 고정 카테고리 포함 차트 데이터 (없는 값은 0으로 표시) */
export function toChartDataWithDefaults(
  record: Record<string, number>,
  defaults: string[],
) {
  const merged: Record<string, number> = {};
  for (const key of defaults) merged[key] = 0;
  for (const [key, val] of Object.entries(record)) merged[key] = val;
  return Object.entries(merged)
    .sort((a, b) => {
      const ka = labelSortKey(a[0]);
      const kb = labelSortKey(b[0]);
      if (ka !== kb) return ka - kb;
      return a[0].localeCompare(b[0], "ko");
    })
    .map(([name, value]) => ({ name, value }));
}

export const AGE_GROUPS = ["20대", "30대", "40대", "50대", "60대 이상"];
const GENDER_DEFAULTS = ["여성", "남성"];
const CHANNEL_GROUPS = ["SNS", "지인 추천", "검색", "카페/커뮤니티", "블로그", "유튜브", "기타"];

/** 특정 항목을 맨 위/맨 아래로 고정 (대소문자 무시) */
export function pinItems(
  data: { name: string; value: number }[],
  opts: { top?: string[]; bottom?: string[] },
) {
  const match = (name: string, list: string[]) =>
    list.some((k) => name.toLowerCase() === k.toLowerCase());
  const top = opts.top ? data.filter((d) => match(d.name, opts.top!)) : [];
  const bottom = opts.bottom ? data.filter((d) => match(d.name, opts.bottom!)) : [];
  const middle = data.filter((d) => !top.includes(d) && !bottom.includes(d));
  return [...top, ...middle, ...bottom];
}

/** 성별 데이터: 여성(위) → 남성(아래) 고정 순서 + 고정 색상 */
export function toGenderData(record: Record<string, number>): { data: { name: string; value: number }[]; colors: string[] } {
  const ordered: { name: string; value: number }[] = [];
  for (const g of GENDER_DEFAULTS) {
    ordered.push({ name: g, value: record[g] || 0 });
  }
  for (const [name, value] of Object.entries(record)) {
    if (!GENDER_DEFAULTS.includes(name)) ordered.push({ name, value });
  }
  const colors = ordered.map((d) => GENDER_COLOR_MAP[d.name] || PIE_COLORS[0]);
  return { data: ordered, colors };
}

function pctLabel(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

// ---- helpers: safe rendering ----

/** 차트 데이터의 name/value를 문자열/숫자로 강제 정규화 */
function safeChartData(data: { name: string; value: number }[]): { name: string; value: number }[] {
  return data.map((d) => ({
    name: typeof d.name === "string" ? d.name : String(d.name ?? ""),
    value: typeof d.value === "number" ? d.value : (Number(d.value) || 0),
  }));
}

/** 값이 객체인 경우 안전하게 문자열로 변환 */
function safe(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

// ---- sub-components ----

export function SummaryCard({ label, value, sub, tip }: { label: string; value: string | number; sub?: string; tip?: string }) {
  return (
    <div className={`rounded-xl border bg-card p-4 text-center ${tip ? "cursor-help" : "cursor-default"}`} title={tip}>
      <div className="text-[12px] text-muted-foreground mb-1">{safe(label)}</div>
      <div className="text-2xl font-extrabold">{safe(value)}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{safe(sub)}</div>}
    </div>
  );
}

export function ChartCard({ title, children, empty, tip }: { title: string; children: React.ReactNode; empty?: boolean; tip?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className={`text-[13px] font-bold mb-3 ${tip ? "cursor-help" : "cursor-default"}`} title={tip}>{title}</div>
      {empty ? (
        <div className="text-[12px] text-muted-foreground text-center py-8">데이터 없음</div>
      ) : (
        children
      )}
    </div>
  );
}

export function DonutChart({ data: rawData, colors }: { data: { name: string; value: number }[]; colors?: string[] }) {
  const data = safeChartData(rawData);
  const total = data.reduce((s, d) => s + d.value, 0);
  const getColor = (i: number) => colors?.[i] ?? PIE_COLORS[i % PIE_COLORS.length];
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={38}
            outerRadius={62}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={getColor(i)} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v}명 (${pctLabel(v, total)})`]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 text-[12px]">
        {data.map((d, i) => (
          <div key={String(d.name)} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: getColor(i) }}
            />
            <span className="text-muted-foreground">{safe(d.name)}</span>
            <span className="font-semibold">{safe(d.value)}명</span>
            <span className="text-muted-foreground">({pctLabel(d.value, total)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBarChart({ data: rawData }: { data: { name: string; value: number }[] }) {
  const data = safeChartData(rawData);
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const renderLabel = (props: { x: number; y: number; width: number; height: number; value: number }) => {
    const v = Number(props.value) || 0;
    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
    return (
      <text x={props.x + props.width + 4} y={props.y + props.height / 2} dominantBaseline="central" fontSize={11} fill="#666">
        {String(v)}<tspan fontSize={9} fill="#999">({String(pct)}%)</tspan>
      </text>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 32 + 8, 80)}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 50, top: 0, bottom: 0 }}>
        <XAxis type="number" hide domain={[0, maxVal]} />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(v: number) => [`${v}명 (${total > 0 ? Math.round((v / total) * 100) : 0}%)`]} />
        <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={18} label={renderLabel} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RecDonut({ postResponses }: { postResponses: SurveyResponse[] }) {
  if (postResponses.length === 0) return <div className="text-[12px] text-muted-foreground text-center py-8">데이터 없음</div>;

  let yesCount = 0;
  let noCount = 0;
  let etcCount = 0;

  for (const r of postResponses) {
    const v = safe(r.pRec).trim();
    if (!v) continue;
    if (/네|넵|추천|강추|할|싶/i.test(v)) yesCount++;
    else if (/아니|없|안|글쎄/i.test(v)) noCount++;
    else etcCount++;
  }

  const data = [
    { name: "추천", value: yesCount },
    { name: "비추천", value: noCount },
    ...(etcCount > 0 ? [{ name: "기타", value: etcCount }] : []),
  ].filter((d) => d.value > 0);

  if (data.length === 0) return <div className="text-[12px] text-muted-foreground text-center py-8">데이터 없음</div>;
  return <DonutChart data={data} />;
}

/** 긴 라벨용 세로 리스트 + 인라인 바 (expectedBenefit 등) */
export function ListBar({ data: rawData, hidePercent, largeText }: { data: { name: string; value: number }[]; hidePercent?: boolean; largeText?: boolean }) {
  const data = safeChartData(rawData);
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const nameSize = largeText ? "text-[14px]" : "text-[12px]";
  const countSize = largeText ? "text-[12px]" : "text-[11px]";
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
        return (
          <div key={String(d.name)}>
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <span className={`${nameSize} text-foreground leading-snug`}>{safe(d.name)}</span>
              <span className={`${countSize} text-muted-foreground whitespace-nowrap shrink-0`}>
                {safe(d.value)}명{hidePercent ? "" : ` (${String(pct)}%)`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[#3451B2] transition-all"
                style={{ width: `${(d.value / maxVal) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 접이식 텍스트 리스트 (selectReason 등 자유 서술형) */
export function CollapsibleTextList({ responses, pattern, emptyMsg }: { responses: SurveyResponse[]; pattern: RegExp; emptyMsg?: string }) {
  const [open, setOpen] = useState(true);
  const items = useMemo(() => {
    const result: { name: string; text: string }[] = [];
    for (const r of responses) {
      if (!r.rawData) continue;
      const text = safe(extractFromRawData(r.rawData, pattern)).trim();
      if (text.length > 1) result.push({ name: safe(r.name), text });
    }
    return result;
  }, [responses, pattern]);

  if (items.length === 0) return <div className="text-[12px] text-muted-foreground text-center py-8">{emptyMsg || "데이터 없음"}</div>;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:underline"
      >
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        응답 {items.length}건 {open ? "접기" : "펼치기"}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 max-h-[300px] overflow-y-auto">
          {items.map((item, i) => (
            <li key={i} className="text-[13px] pl-3 border-l-2 border-muted">
              <span className="font-medium text-foreground/70">{safe(item.name)}</span>{" "}
              <span className="text-muted-foreground">{safe(item.text)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 있음/없음 도넛 + 상세 리스트 (prevCourse) */
export function YesNoDonutWithDetails({
  data,
  details,
  noDetails,
  blockedItems,
  onRemove,
  onRestore,
}: {
  data: { name: string; value: number }[];
  details: string[];
  noDetails?: string[];
  blockedItems?: string[];
  onRemove?: (text: string) => void;
  onRestore?: (text: string) => void;
}) {
  const [yesOpen, setYesOpen] = useState(true);
  const [noOpen, setNoOpen] = useState(false);
  const yesCount = data.find((d) => d.name === "있음")?.value || 0;
  const noCount = data.find((d) => d.name === "없음")?.value || 0;
  const allNoDetails = useMemo(() => {
    const blocked = blockedItems || [];
    return [...blocked, ...(noDetails || [])];
  }, [blockedItems, noDetails]);

  return (
    <div>
      <DonutChart data={data} colors={["#3451B2", "#889096"]} />
      {/* 있음 상세 */}
      {yesCount > 0 && details.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <button
            type="button"
            onClick={() => setYesOpen(!yesOpen)}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline"
          >
            {yesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            수강 이력 {details.length}건 {yesOpen ? "접기" : "보기"}
          </button>
          {yesOpen && (
            <ul className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
              {details.map((d, i) => (
                <li
                  key={i}
                  onClick={onRemove ? () => onRemove(d) : undefined}
                  className={`text-[12px] text-muted-foreground pl-3 border-l-2 border-muted ${
                    onRemove ? "cursor-pointer hover:line-through hover:text-destructive/70 transition-colors" : ""
                  }`}
                  title={onRemove ? "클릭하여 없음 처리" : undefined}
                >
                  {safe(d)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {/* 없음 상세 (자동 분류 + 블랙리스트 합산) */}
      {noCount > 0 && allNoDetails.length > 0 && (
        <div className="mt-3 pt-3 border-t border-dashed">
          <button
            type="button"
            onClick={() => setNoOpen(!noOpen)}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
          >
            {noOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            없음 응답 {allNoDetails.length}건 {noOpen ? "접기" : "보기"}
          </button>
          {noOpen && (
            <ul className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
              {allNoDetails.map((d, i) => {
                const isBlocked = blockedItems?.includes(d);
                return (
                  <li
                    key={i}
                    onClick={onRestore && isBlocked ? () => onRestore(d) : undefined}
                    className={`text-[12px] text-muted-foreground pl-3 border-l-2 ${
                      isBlocked
                        ? "border-amber-300 cursor-pointer hover:line-through hover:text-primary/70 transition-colors"
                        : "border-muted"
                    }`}
                    title={isBlocked ? "클릭하여 있음으로 되돌리기" : undefined}
                  >
                    {safe(d)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---- main ----

interface TabOverviewProps {
  instructor: Instructor;
  course: Course | null;
  cohort: Cohort | null;
  platformName: string;
  readOnly?: boolean;
}

export function TabOverview({ instructor, course, cohort, platformName, readOnly }: TabOverviewProps) {
  const [blocklist, setBlocklist] = useState<string[]>([]);

  useEffect(() => {
    getAppSettings()
      .then((d) => {
        if (Array.isArray(d.prevCourseBlocklist)) setBlocklist(d.prevCourseBlocklist);
      })
      .catch(() => {});
  }, []);

  const handleRemovePrevCourse = useCallback(async (text: string) => {
    setBlocklist((prev) => [...prev, text]);
    try {
      await fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "prevCourse_blocklist", action: "add", text }),
      });
      toast.success("없음 처리됨 — 모든 강사에 적용");
    } catch {
      setBlocklist((prev) => prev.filter((t) => t !== text));
      toast.error("저장 실패");
    }
  }, []);

  const handleRestorePrevCourse = useCallback(async (text: string) => {
    setBlocklist((prev) => prev.filter((t) => t !== text));
    try {
      await fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "prevCourse_blocklist", action: "remove", text }),
      });
      toast.success("있음으로 복원됨 — 모든 강사에 적용");
    } catch {
      setBlocklist((prev) => [...prev, text]);
      toast.error("복원 실패");
    }
  }, []);

  // 응답 수집
  const { preResponses, postResponses } = useMemo(() => {
    const cohorts = cohort
      ? [cohort]
      : course
        ? (course.cohorts || [])
        : allCohorts(instructor);
    return {
      preResponses: cohorts.flatMap((c) => Array.isArray(c.preResponses) ? c.preResponses : []),
      postResponses: cohorts.flatMap((c) => Array.isArray(c.postResponses) ? c.postResponses : []),
    };
  }, [instructor, course, cohort]);

  const allResponses = useMemo(() => [...preResponses, ...postResponses], [preResponses, postResponses]);

  const demographics = useMemo(() => computeDemographics(allResponses), [allResponses]);
  const scores = useMemo(() => computeScores(postResponses), [postResponses]);
  const satItems = useMemo(() => getSatisfactionItems(postResponses), [postResponses]);

  // 동적 설문 질문 (rawData 미매핑)
  const extraPreQuestions = useMemo(() => collectExtraQuestions(preResponses), [preResponses]);
  const extraPostQuestions = useMemo(() => collectExtraQuestions(postResponses), [postResponses]);

  // 설문 질문 보기 모달
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const preQuestions = useMemo(() => collectAllQuestions(preResponses), [preResponses]);
  const postQuestions = useMemo(() => collectAllQuestions(postResponses), [postResponses]);

  // 블랙리스트 적용 — 모든 hook은 early return 전에 호출
  const { filteredPrevCourseData, filteredPrevCourseDetails, blockedPrevCourseItems } = useMemo(() => {
    const blockedItems = demographics.prevCourseDetails.filter((d) => blocklist.includes(d));
    const filteredDetails = demographics.prevCourseDetails.filter((d) => !blocklist.includes(d));
    const adjustedPrevCourse = { ...demographics.prevCourse };
    if (blockedItems.length > 0) {
      adjustedPrevCourse["있음"] = Math.max(0, (adjustedPrevCourse["있음"] || 0) - blockedItems.length);
      adjustedPrevCourse["없음"] = (adjustedPrevCourse["없음"] || 0) + blockedItems.length;
    }
    return {
      filteredPrevCourseData: toChartData(adjustedPrevCourse),
      filteredPrevCourseDetails: filteredDetails,
      blockedPrevCourseItems: blockedItems,
    };
  }, [demographics.prevCourse, demographics.prevCourseDetails, blocklist]);

  // 선호 강의 방식 (후기 설문 pFmt) — 모든 hook은 early return 전에 호출
  const fmtData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of postResponses) {
      const fmt = typeof r.pFmt === "string" ? r.pFmt : String(r.pFmt ?? "");
      if (!fmt) continue;
      const parts = fmt.split("|").map((s) => s.trim());
      for (const p of parts) {
        if (p) counts[p] = (counts[p] || 0) + 1;
      }
    }
    return toChartData(counts);
  }, [postResponses]);

  const noData = preResponses.length === 0 && postResponses.length === 0;

  if (noData) {
    return (
      <div className="text-center py-16">
        <div className="text-[14px] font-semibold text-muted-foreground">데이터 없음</div>
        <div className="text-[12px] text-muted-foreground mt-1">
          설문 파일을 업로드하면 차트가 표시됩니다.
        </div>
      </div>
    );
  }

  const scopeLabel = cohort
    ? `${cohort.label}`
    : course
      ? `${course.name} 전체`
      : `${instructor.name} 전체`;

  // chart data
  const gender = toGenderData(demographics.gender);
  const ageData = toChartDataWithDefaults(demographics.age, AGE_GROUPS);
  const jobData = pinItems(toChartData(demographics.job), { bottom: ["기타"] });
  const hoursData = toChartData(demographics.hours);
  const channelData = toChartDataWithDefaults(demographics.channel, CHANNEL_GROUPS);
  const prevCourseData = filteredPrevCourseData;
  const expectedBenefitData = pinItems(toChartData(demographics.expectedBenefit), { bottom: ["기타"] });
  const satData = satItems.map((s) => ({ name: s.label, value: s.count }));
  const computerData = Object.entries(demographics.computer.distribution)
    .map(([score, count]) => ({ name: `${score}점`, value: count }))
    .sort((a, b) => parseInt(a.name) - parseInt(b.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
        <span>{platformName} · {scopeLabel}</span>
        <button
          type="button"
          onClick={() => setQuestionsOpen(true)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <ClipboardList className="w-3 h-3" />
          설문 질문 보기
        </button>
      </div>

      {/* 설문 질문 목록 모달 */}
      {questionsOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[200] flex items-center justify-center"
          onClick={() => setQuestionsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-[14px] p-7 shadow-xl border max-h-[80vh] overflow-y-auto"
            style={{ width: 560 }}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-[17px] font-extrabold">설문 질문 목록</h3>
              <button
                onClick={() => setQuestionsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 사전 설문 */}
            <div className="mb-5">
              <div className="text-[13px] font-bold mb-2">📋 사전 설문</div>
              {preQuestions.length > 0 ? (
                <ol className="list-decimal list-inside space-y-1 text-[13px] text-foreground/80 pl-1">
                  {preQuestions.map((q, i) => (
                    <li key={i}>{safe(q)}</li>
                  ))}
                </ol>
              ) : (
                <div className="text-[12px] text-muted-foreground py-3">해당 설문 데이터 없음</div>
              )}
            </div>

            {/* 후기 설문 */}
            <div>
              <div className="text-[13px] font-bold mb-2">📋 후기 설문</div>
              {postQuestions.length > 0 ? (
                <ol className="list-decimal list-inside space-y-1 text-[13px] text-foreground/80 pl-1">
                  {postQuestions.map((q, i) => (
                    <li key={i}>{safe(q)}</li>
                  ))}
                </ol>
              ) : (
                <div className="text-[12px] text-muted-foreground py-3">해당 설문 데이터 없음</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="사전 응답 수" value={`${preResponses.length}명`} tip="강의 시작 전 사전 설문에 참여한 총 응답자 수" />
        <SummaryCard label="후기 응답 수" value={`${postResponses.length}명`} tip="강의 종료 후 후기 설문에 참여한 총 응답자 수" />
        <SummaryCard
          label="만족도 점수"
          value={scores.ps1Avg > 0 || scores.ps2Avg > 0
            ? `${((scores.ps1Avg + scores.ps2Avg) / (scores.ps1Avg > 0 && scores.ps2Avg > 0 ? 2 : 1)).toFixed(1)}`
            : "-"}
          sub="10점 만점"
          tip="후기 설문의 '커리큘럼 만족도'와 '피드백 만족도' 점수의 평균입니다. 10점 만점 기준으로 환산됩니다."
        />
        <SummaryCard
          label="추천률"
          value={postResponses.length > 0 ? `${scores.recRate}%` : "-"}
          tip="후기 설문 '이 강의를 지인분들께 추천하실 것 같으신가요?' 문항에서 긍정 응답을 한 비율입니다."
        />
      </div>

      {/* charts */}
      <div className="grid grid-cols-2 gap-5">
        <ErrorBoundary name="차트:성별">
          <ChartCard title="성별" empty={gender.data.length === 0} tip="사전 설문 '성별' 항목 응답 분포">
            <DonutChart data={gender.data} colors={gender.colors} />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:연령대">
          <ChartCard title="연령대" empty={ageData.length === 0} tip="사전 설문 '연령대' 항목 응답 분포">
            <HBarChart data={ageData} />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:직업">
          <ChartCard title="현재 하고 계신 일" empty={jobData.length === 0} tip="사전 설문 '현재 하고 계신 일이 무엇인가요?' 항목 응답 분포">
            <HBarChart data={jobData} />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:부업시간">
          <ChartCard title="하루에 평균적으로 부업에 투자할 수 있는 시간" empty={hoursData.length === 0} tip="사전 설문 '하루에 평균적으로 부업에 투자할 수 있는 시간' 항목 응답 분포">
            <HBarChart data={hoursData} />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:컴퓨터활용">
          <ChartCard title={`컴퓨터 활용 능력${demographics.computer.avg > 0 ? ` (평균 ${demographics.computer.avg}점)` : ""}`} empty={computerData.length === 0} tip="사전 설문 '나의 컴퓨터 활용 능력은?' 항목 응답 분포 (10점 만점)">
            <HBarChart data={computerData} />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:유입경로">
          <ChartCard title="알게 되신 경로" empty={channelData.length === 0} tip="사전 설문 '핏크닉(머니업클래스)을 알게 되신 경로는?' 항목 응답 분포">
            <HBarChart data={channelData} />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:수강이력">
          <ChartCard title="핏크닉 다른 정규강의 수강 이력" empty={prevCourseData.length === 0} tip="사전 설문 '핏크닉의 다른 정규강의를 수강하신 적이 있나요?' 항목 응답 분포">
            <YesNoDonutWithDetails
              data={prevCourseData}
              details={filteredPrevCourseDetails}
              noDetails={demographics.prevCourseNoDetails}
              blockedItems={!readOnly ? blockedPrevCourseItems : undefined}
              onRemove={!readOnly ? handleRemovePrevCourse : undefined}
              onRestore={!readOnly ? handleRestorePrevCourse : undefined}
            />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:선택이유">
          <ChartCard title="강사님 강의를 선택하신 이유" empty={preResponses.length === 0} tip="사전 설문 '핏크닉의 강사님 강의를 선택하신 이유가 어떻게 되시나요?' (자유 서술)">
            <CollapsibleTextList responses={preResponses} pattern={RAW_DATA_PATTERNS.selectReason} />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:기대혜택">
          <ChartCard title="이번 강의 혜택 중 가장 기대되는 혜택" empty={expectedBenefitData.length === 0} tip="사전 설문 '이번 강의 혜택 중 가장 필요한(기대되는) 혜택은 무엇인가요?' 항목 응답 분포">
            <ListBar data={expectedBenefitData} />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:만족스러웠던점">
          <ChartCard title="수강 과정 중 만족스러웠던 점" empty={satData.length === 0} tip="후기 설문 '수강 과정 중 가장 만족스러웠던 점' 항목별 집계">
            <HBarChart data={satData} />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:선호강의방식">
          <ChartCard title="선호하는 강의 방식" empty={fmtData.length === 0} tip="후기 설문 '선호하는 강의 방식(형태)' 항목 응답 분포">
            <ListBar data={fmtData} />
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:커리큘럼만족도">
          <ChartCard title="전반적인 강의 커리큘럼 만족도" empty={postResponses.length === 0} tip="후기 설문 '전반적인 강의 커리큘럼 만족도는 몇 점이었나요?'와 '강사님의 피드백은 적절히 이루어졌나요?' 점수를 10점 만점으로 환산">
            <div className="flex items-center justify-center gap-8 py-4">
              <RingScore score={scores.ps1Avg} size={80} label="커리큘럼" excluded={scores.ps1Excluded} />
              <RingScore score={scores.ps2Avg} size={80} label="피드백" excluded={scores.ps2Excluded} />
            </div>
          </ChartCard>
        </ErrorBoundary>

        <ErrorBoundary name="차트:추천의향">
          <ChartCard title="이 강의를 지인분들께 추천하실 것 같으신가요?" empty={postResponses.length === 0} tip="후기 설문 추천 의향 문항의 긍정/부정 응답 비율">
            <RecDonut postResponses={postResponses} />
          </ChartCard>
        </ErrorBoundary>

        {/* 동적 사전 설문 질문 */}
        {extraPreQuestions.map((eq, i) => (
          <ErrorBoundary key={`pre-extra-${i}`} name={`차트:사전동적-${safe(eq.question).slice(0, 15)}`}>
            <ChartCard title={safe(eq.question)} tip={`사전 설문 '${safe(eq.question)}' 항목 응답 분포 (${eq.total}명)`}>
              <ListBar data={toChartData(eq.summary)} />
            </ChartCard>
          </ErrorBoundary>
        ))}

        {/* 동적 후기 설문 질문 */}
        {extraPostQuestions.map((eq, i) => (
          <ErrorBoundary key={`post-extra-${i}`} name={`차트:후기동적-${safe(eq.question).slice(0, 15)}`}>
            <ChartCard title={safe(eq.question)} tip={`후기 설문 '${safe(eq.question)}' 항목 응답 분포 (${eq.total}명)`}>
              <ListBar data={toChartData(eq.summary)} />
            </ChartCard>
          </ErrorBoundary>
        ))}
      </div>
    </div>
  );
}
