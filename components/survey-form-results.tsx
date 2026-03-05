"use client";

import { useState, useEffect, useMemo } from "react";
import type { SurveyForm, FormField } from "@/lib/types";
import { KEY_TO_COLUMN } from "@/lib/form-utils";
import {
  ChartCard,
  DonutChart,
  HBarChart,
  ListBar,
  toChartData,
} from "@/components/tab-overview";
import {
  ChevronLeft,
  Loader2,
  FileText,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  Pencil,
  BarChart3,
} from "lucide-react";

// ===== 타입 =====

interface ResponseRow {
  name: string;
  gender: string;
  age: string;
  job: string;
  hours: string;
  channel: string;
  computer: number;
  goal: string;
  ps1: number;
  ps2: number;
  p_sat: string;
  p_fmt: string;
  p_free: string;
  p_rec: string;
  raw_data: Record<string, string> | null;
  created_at: string;
  [key: string]: unknown;
}

interface Props {
  form: SurveyForm;
  onBack: () => void;
  onEdit: () => void;
}

// ===== 헬퍼 =====

/** 필드 키에 해당하는 응답값 추출 */
function getFieldValue(row: ResponseRow, field: FormField): string {
  const col = KEY_TO_COLUMN[field.key];
  if (col) {
    const v = row[col];
    if (v == null) return "";
    return String(v);
  }
  // 커스텀 필드 → raw_data
  if (row.raw_data && field.key in row.raw_data) {
    return row.raw_data[field.key] || "";
  }
  return "";
}

/** 빈도 집계 */
function tally(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of values) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    counts[trimmed] = (counts[trimmed] || 0) + 1;
  }
  return counts;
}

/** 척도 빈도 (1~max) */
function tallyScale(values: string[], min: number, max: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = min; i <= max; i++) counts[`${i}점`] = 0;
  for (const v of values) {
    const n = parseInt(v);
    if (!isNaN(n) && n >= min && n <= max) {
      counts[`${n}점`] = (counts[`${n}점`] || 0) + 1;
    }
  }
  return counts;
}

// ===== 날짜 포맷 =====

function formatDateRange(responses: ResponseRow[]): string {
  if (responses.length === 0) return "";
  const dates = responses
    .map((r) => r.created_at)
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .sort((a, b) => a - b);
  if (dates.length === 0) return "";
  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };
  if (dates.length === 1) return fmt(dates[0]);
  return `${fmt(dates[0])} ~ ${fmt(dates[dates.length - 1])}`;
}

// ===== 질문별 결과 카드 =====

function FieldResultCard({
  field,
  responses,
  index,
}: {
  field: FormField;
  responses: ResponseRow[];
  index: number;
}) {
  const [open, setOpen] = useState(true);
  const values = useMemo(
    () => responses.map((r) => getFieldValue(r, field)),
    [responses, field]
  );
  const nonEmpty = useMemo(() => values.filter((v) => v.trim()), [values]);

  // 서술형: 텍스트 목록
  if (field.type === "textarea") {
    return (
      <div className="rounded-xl border bg-card p-5">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Q{index}
            </span>
            <span className="text-[13px] font-bold">{field.label}</span>
            <span className="text-[12px] text-muted-foreground">
              ({nonEmpty.length}건)
            </span>
          </div>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {open && (
          <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto">
            {nonEmpty.length === 0 ? (
              <div className="text-[12px] text-muted-foreground text-center py-6">
                응답 없음
              </div>
            ) : (
              nonEmpty.map((text, i) => {
                const name = responses.find(
                  (r) => getFieldValue(r, field) === text
                )?.name;
                return (
                  <div
                    key={i}
                    className="flex gap-3 py-2 px-3 rounded-lg bg-muted/40 text-[13px]"
                  >
                    <span className="text-muted-foreground font-medium shrink-0 min-w-[40px]">
                      {name || `#${i + 1}`}
                    </span>
                    <span className="text-foreground leading-relaxed">
                      {text}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  // radio / select → 도넛 차트
  if (field.type === "radio" || field.type === "select") {
    const counts = tally(nonEmpty);
    const chartData = toChartData(counts);
    return (
      <ChartCard
        title=""
        empty={chartData.length === 0}
      >
        <div className="flex items-center gap-2 -mt-3 mb-3">
          <span className="text-[12px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Q{index}
          </span>
          <span className="text-[13px] font-bold">{field.label}</span>
          <span className="text-[12px] text-muted-foreground">
            ({nonEmpty.length}건)
          </span>
        </div>
        {chartData.length > 0 && <DonutChart data={chartData} />}
      </ChartCard>
    );
  }

  // scale → 수평 바 차트
  if (field.type === "scale") {
    const min = field.scaleMin ?? 1;
    const max = field.scaleMax ?? 5;
    const counts = tallyScale(nonEmpty, min, max);
    const chartData = Object.entries(counts).map(([name, value]) => ({
      name,
      value,
    }));
    return (
      <ChartCard
        title=""
        empty={nonEmpty.length === 0}
      >
        <div className="flex items-center gap-2 -mt-3 mb-3">
          <span className="text-[12px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Q{index}
          </span>
          <span className="text-[13px] font-bold">{field.label}</span>
          <span className="text-[12px] text-muted-foreground">
            ({nonEmpty.length}건)
          </span>
        </div>
        {nonEmpty.length > 0 && <HBarChart data={chartData} />}
      </ChartCard>
    );
  }

  // text / number → ListBar (빈도)
  if (field.type === "text" || field.type === "number") {
    const counts = tally(nonEmpty);
    const chartData = toChartData(counts);
    return (
      <ChartCard
        title=""
        empty={chartData.length === 0}
      >
        <div className="flex items-center gap-2 -mt-3 mb-3">
          <span className="text-[12px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Q{index}
          </span>
          <span className="text-[13px] font-bold">{field.label}</span>
          <span className="text-[12px] text-muted-foreground">
            ({nonEmpty.length}건)
          </span>
        </div>
        {chartData.length > 0 && <ListBar data={chartData} />}
      </ChartCard>
    );
  }

  // closing / image → 스킵
  return null;
}

// ===== 메인 컴포넌트 =====

export function SurveyFormResults({ form, onBack, onEdit }: Props) {
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"results" | "edit">("results");

  useEffect(() => {
    const fetchResponses = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/survey-forms/responses?formId=${form.id}`
        );
        const data = await res.json();
        setResponses(data.responses || []);
      } catch {
        console.error("응답 조회 실패");
      } finally {
        setLoading(false);
      }
    };
    fetchResponses();
  }, [form.id]);

  const visibleFields = useMemo(
    () =>
      (form.fields || [])
        .filter(
          (f) =>
            f.enabled !== false &&
            f.type !== "closing" &&
            f.type !== "image"
        )
        .sort((a, b) => a.order - b.order),
    [form.fields]
  );

  const dateRange = useMemo(() => formatDateRange(responses), [responses]);

  return (
    <div className="max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
          title="뒤로가기"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold truncate">
            {form.title ||
              `${form.instructor} ${form.survey_type} 설문`}
          </h2>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-5">
        <button
          onClick={() => setActiveTab("results")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold transition-all ${
            activeTab === "results"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          설문 결과
        </button>
        <button
          onClick={() => {
            setActiveTab("edit");
            onEdit();
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold transition-all ${
            activeTab === "edit"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          <Pencil className="w-4 h-4" />
          설문 편집
        </button>
      </div>

      {/* 로딩 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-[13px] text-muted-foreground">
            응답 불러오는 중...
          </span>
        </div>
      ) : responses.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[14px] font-bold text-muted-foreground">
            아직 응답이 없습니다
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">
            설문 URL을 수강생에게 공유하면 여기에 결과가 표시됩니다
          </p>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-[12px] text-muted-foreground">
                  총 응답
                </div>
                <div className="text-xl font-extrabold">
                  {responses.length}명
                </div>
              </div>
            </div>
            {dateRange && (
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-[12px] text-muted-foreground">
                    응답 기간
                  </div>
                  <div className="text-[14px] font-bold">{dateRange}</div>
                </div>
              </div>
            )}
          </div>

          {/* 질문별 결과 */}
          <div className="space-y-4">
            {visibleFields.map((field, idx) => (
              <FieldResultCard
                key={field.key}
                field={field}
                responses={responses}
                index={idx + 1}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
