"use client";

import { useState, useEffect, useMemo } from "react";
import type { Instructor, Cohort, Comment, Survey } from "@/lib/types";
import {
  FIELD_LABELS,
  TAG_OPTIONS,
  getTagColor,
  getTagLabel,
  isPlatformTag,
  isUsefulComment,
  effectiveTag,
  groupByField,
  type CommentWithCohort,
  type PlatformSub,
} from "@/lib/feedback-utils";
import { Loader2, Search, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";

interface TabAnalysisProps {
  instructor: Instructor;
  cohort: Cohort | null;
  platformName: string;
}

type AnalysisView = "category" | "instructor" | "platform";

export function TabAnalysis({ instructor, cohort, platformName }: TabAnalysisProps) {
  const [comments, setComments] = useState<CommentWithCohort[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [analysisView, setAnalysisView] = useState<AnalysisView>("category");
  const [platformSub, setPlatformSub] = useState<PlatformSub>("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // 강사 뷰 전용: 체크박스 + 복사
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const cohortLabel = cohort?.label || null;

  useEffect(() => {
    loadComments();
  }, [platformName, instructor.name, cohortLabel]);

  // 뷰 변경 시 선택 초기화
  useEffect(() => {
    setSelected(new Set());
  }, [analysisView]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        platform: platformName,
        instructor: instructor.name,
      });
      if (cohortLabel) params.set("cohort", cohortLabel);

      const res = await fetch(`/api/classify?${params}`);
      if (!res.ok) throw new Error();
      const data: Comment[] = await res.json();
      const useful = data.filter(isUsefulComment);

      if (!cohortLabel) {
        const surveyRes = await fetch("/api/surveys");
        if (surveyRes.ok) {
          const surveys: Survey[] = await surveyRes.json();
          const surveyMap = new Map(surveys.map((s) => [s.id, s.cohort || ""]));
          setComments(useful.map((c) => ({ ...c, cohortLabel: surveyMap.get(c.survey_id) || "" })));
        } else {
          setComments(useful);
        }
      } else {
        setComments(useful.map((c) => ({ ...c, cohortLabel })));
      }
      setLoaded(true);
    } catch {
      toast.error("분석 데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  // 기수 목록
  const cohortLabels = useMemo(() => {
    const labels = new Set(comments.map((c) => c.cohortLabel).filter(Boolean));
    return Array.from(labels).sort();
  }, [comments]);

  // 뷰별 필터링
  const filtered = useMemo(() => {
    return comments.filter((c) => {
      const et = effectiveTag(c);

      // 뷰별 기본 필터
      if (analysisView === "instructor" && et !== "instructor") return false;
      if (analysisView === "platform") {
        if (!isPlatformTag(et)) return false;
        if (platformSub === "pm" && et !== "platform_pm") return false;
        if (platformSub === "pd" && et !== "platform_pd") return false;
        if (platformSub === "cs" && et !== "platform_cs") return false;
        if (platformSub === "etc" && et !== "platform_etc") return false;
      }

      if (cohortFilter !== "all" && c.cohortLabel !== cohortFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.original_text.toLowerCase().includes(s) && !c.respondent.toLowerCase().includes(s))
          return false;
      }
      return true;
    });
  }, [comments, analysisView, platformSub, cohortFilter, search]);

  const grouped = useMemo(() => groupByField(filtered), [filtered]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copySelected = () => {
    const items = filtered.filter((c) => selected.has(c.id));
    const text = items
      .map((c) => `"${c.original_text}" — ${c.respondent}${c.cohortLabel ? `, ${c.cohortLabel}` : ""}`)
      .join("\n\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.success(`${items.length}건 복사됨`);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !loaded) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
        <div className="text-[13px] text-muted-foreground">분석 데이터 로딩 중...</div>
      </div>
    );
  }

  if (loaded && comments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="text-[30px] opacity-25 mb-2">📋</div>
        <div className="text-[14px] font-bold">분류된 데이터가 없습니다</div>
        <div className="text-[13px] mt-1">피드백 탭에서 댓글을 분류하면 여기에서 볼 수 있습니다</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {/* 뷰 모드 선택 */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
          {([
            { id: "category" as const, label: "목차별" },
            { id: "instructor" as const, label: "강사" },
            { id: "platform" as const, label: "플랫폼" },
          ]).map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setAnalysisView(v.id);
                setPlatformSub("all");
              }}
              className={`py-1.5 px-4 rounded-md text-[12px] transition-colors ${
                analysisView === v.id
                  ? "bg-card font-bold text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* 플랫폼 뷰 서브필터 */}
        {analysisView === "platform" && (
          <div className="flex gap-0.5 bg-blue-50 rounded-lg p-0.5 border border-blue-200">
            {([
              { id: "all" as const, label: "전체" },
              { id: "pm" as const, label: "PM" },
              { id: "pd" as const, label: "PD" },
              { id: "cs" as const, label: "CS" },
              { id: "etc" as const, label: "기타" },
            ]).map((f) => (
              <button
                key={f.id}
                onClick={() => setPlatformSub(f.id)}
                className={`py-1 px-2.5 rounded-md text-[11px] transition-colors ${
                  platformSub === f.id
                    ? "bg-white font-bold text-blue-700 shadow-sm"
                    : "text-blue-600/70 hover:text-blue-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* 기수 필터 */}
        {!cohort && cohortLabels.length > 1 && (
          <select
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border text-[12px] bg-card"
          >
            <option value="all">전체 기수</option>
            {cohortLabels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}

        {/* 검색 */}
        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색..."
            className="w-full py-1.5 pl-8 pr-3 rounded-lg border text-[13px] bg-card"
          />
        </div>

        <span className="text-[12px] text-muted-foreground">{filtered.length}건</span>
      </div>

      {/* 그룹별 카드 */}
      <div className="grid gap-4 max-h-[calc(100vh-360px)] overflow-y-auto">
        {grouped.map(([sourceField, items]) => (
          <div key={sourceField}>
            {/* 그룹 헤더 */}
            <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
              <span className="text-[13px] font-bold">
                {FIELD_LABELS[sourceField] || sourceField}
              </span>
              <span className="text-[11px] text-muted-foreground">{items.length}건</span>
              <div className="flex-1 border-b" />
            </div>

            {/* 카드 */}
            <div className="grid gap-1.5">
              {items.map((comment) => {
                const et = effectiveTag(comment);
                const isSelected = selected.has(comment.id);

                return (
                  <div
                    key={comment.id}
                    className={`py-2.5 px-3.5 rounded-lg border bg-card transition-colors ${
                      isSelected ? "ring-2 ring-primary/30 bg-primary/3" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* 강사 뷰에서만 체크박스 */}
                      {analysisView === "instructor" && (
                        <label className="mt-0.5 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(comment.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        </label>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] leading-relaxed">{comment.original_text}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground/60">
                            {comment.respondent}
                          </span>
                          {comment.cohortLabel && <span>{comment.cohortLabel}</span>}
                        </div>
                      </div>

                      {/* 태그 뱃지 (읽기 전용) */}
                      <span
                        className={`shrink-0 text-[10px] py-0.5 px-1.5 rounded border font-semibold ${getTagColor(et)}`}
                      >
                        {getTagLabel(et)}
                      </span>

                      {/* 감정 뱃지 */}
                      {comment.sentiment && (
                        <span
                          className={`shrink-0 text-[10px] py-0.5 px-1.5 rounded border font-semibold ${
                            comment.sentiment === "positive"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : comment.sentiment === "negative"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-gray-50 text-gray-500 border-gray-200"
                          }`}
                        >
                          {comment.sentiment === "positive"
                            ? "긍정"
                            : comment.sentiment === "negative"
                            ? "부정"
                            : "중립"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-[13px]">
            해당 조건의 데이터가 없습니다
          </div>
        )}
      </div>

      {/* 강사 뷰 전용 액션 바 */}
      {analysisView === "instructor" && selected.size > 0 && (
        <div className="sticky bottom-0 flex items-center gap-3 py-3 px-4 bg-card rounded-xl border shadow-lg">
          <span className="text-[13px] font-bold">{selected.size}건 선택됨</span>
          <button
            onClick={() => {
              if (selected.size === filtered.length) setSelected(new Set());
              else setSelected(new Set(filtered.map((c) => c.id)));
            }}
            className="text-[12px] text-primary font-semibold hover:underline"
          >
            {selected.size === filtered.length ? "선택 해제" : "전체 선택"}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setSelected(new Set())}
            className="py-1.5 px-3 rounded-lg border text-[12px] text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            해제
          </button>
          <button
            onClick={copySelected}
            className="py-1.5 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "복사됨" : "원문 복사"}
          </button>
        </div>
      )}
    </div>
  );
}
