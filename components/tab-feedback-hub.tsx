"use client";

import { useState, useEffect, useMemo } from "react";
import type { Instructor, Cohort, Comment, Survey } from "@/lib/types";
import { Loader2, Search, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";

interface TabFeedbackHubProps {
  instructor: Instructor;
  cohort: Cohort | null;
  platformName: string;
}

type TagValue = Comment["tag"];

// 수치 집계용 필드는 피드백에서 제외
const EXCLUDED_FIELDS = new Set(["pSat", "pRec"]);

const NOISE_RE = /^(네|예|아니요|없습니다|없음|감사합니다|고맙습니다|좋습니다|좋았습니다|잘 모르겠습니다|모르겠습니다|특별히 없습니다|딱히 없습니다|아직 없습니다|글쎄요|x|X|-|강의 내용|커리큘럼|피드백|추천합니다|네 추천합니다|예 추천합니다|네 너무 좋습니다|없어요|없읒|[.\s]*)$/;

function isUsefulComment(c: { original_text: string; source_field: string }): boolean {
  if (EXCLUDED_FIELDS.has(c.source_field)) return false;
  const text = c.original_text.trim();
  if (text.length < 5) return false;
  if (NOISE_RE.test(text)) return false;
  return true;
}

// source_field → 한글 라벨
const FIELD_LABELS: Record<string, string> = {
  hopePlatform: "플랫폼에 바라는 점",
  hopeInstructor: "강사에게 바라는 점",
  pFree: "자유 의견",
  lowScoreReason: "커리큘럼 불만족 사유",
  lowFeedbackRequest: "피드백 개선 요청",
};

// 태그 → 표시
const TAG_OPTIONS = [
  { value: "", label: "미분류", color: "bg-gray-50 text-gray-500 border-gray-200" },
  { value: "platform_pm", label: "PM", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "platform_pd", label: "PD", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "platform_cs", label: "CS", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { value: "platform_etc", label: "기타", color: "bg-slate-50 text-slate-600 border-slate-200" },
  { value: "instructor", label: "강사", color: "bg-orange-50 text-orange-700 border-orange-200" },
] as const;

function getTagColor(tag: TagValue): string {
  return TAG_OPTIONS.find((o) => o.value === (tag || ""))?.color || TAG_OPTIONS[0].color;
}

function isPlatformTag(tag: TagValue): boolean {
  return tag === "platform_pm" || tag === "platform_pd" || tag === "platform_cs" || tag === "platform_etc";
}

// source_field 기반 자동 추천 태그 (tag가 null일 때 사용)
function suggestTag(sourceField: string): TagValue {
  if (sourceField === "hopePlatform") return "platform_etc";
  if (sourceField === "hopeInstructor") return "instructor";
  return null;
}

interface CommentWithCohort extends Comment {
  cohortLabel?: string;
}

type ViewMode = "all" | "platform" | "instructor" | "untagged";
type PlatformSub = "all" | "pm" | "pd" | "cs" | "etc";

export function TabFeedbackHub({ instructor, cohort, platformName }: TabFeedbackHubProps) {
  const [comments, setComments] = useState<CommentWithCohort[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [platformSub, setPlatformSub] = useState<PlatformSub>("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const cohortLabel = cohort?.label || null;

  useEffect(() => {
    loadComments();
  }, [platformName, instructor.name, cohortLabel]);

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
      toast.error("피드백 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  // 실효 태그: 저장된 tag 또는 source_field 기반 추천
  const effectiveTag = (c: CommentWithCohort): TagValue => c.tag ?? suggestTag(c.source_field);

  // 기수 목록
  const cohortLabels = useMemo(() => {
    const labels = new Set(comments.map((c) => c.cohortLabel).filter(Boolean));
    return Array.from(labels).sort();
  }, [comments]);

  // 필터링
  const filtered = useMemo(() => {
    return comments.filter((c) => {
      const et = effectiveTag(c);

      if (viewMode === "platform") {
        if (!isPlatformTag(et)) return false;
        if (platformSub === "pm" && et !== "platform_pm") return false;
        if (platformSub === "pd" && et !== "platform_pd") return false;
        if (platformSub === "cs" && et !== "platform_cs") return false;
        if (platformSub === "etc" && et !== "platform_etc") return false;
      }
      if (viewMode === "instructor" && et !== "instructor") return false;
      if (viewMode === "untagged" && et !== null) return false;

      if (cohortFilter !== "all" && c.cohortLabel !== cohortFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.original_text.toLowerCase().includes(s) && !c.respondent.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [comments, viewMode, platformSub, cohortFilter, search]);

  // 항목별 그룹핑
  const grouped = useMemo(() => {
    const groups: Record<string, CommentWithCohort[]> = {};
    for (const c of filtered) {
      const key = c.source_field;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    // 정렬: hopePlatform → hopeInstructor → pFree → lowScoreReason → lowFeedbackRequest → 기타
    const order = ["hopePlatform", "hopeInstructor", "pFree", "lowScoreReason", "lowFeedbackRequest"];
    const sorted = Object.entries(groups).sort(([a], [b]) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return sorted;
  }, [filtered]);

  // 카운트
  const platformCount = comments.filter((c) => isPlatformTag(effectiveTag(c))).length;
  const instructorCount = comments.filter((c) => effectiveTag(c) === "instructor").length;
  const untaggedCount = comments.filter((c) => effectiveTag(c) === null).length;

  const handleTagChange = async (commentId: string, tag: TagValue) => {
    try {
      await fetch("/api/classify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, tag }),
      });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, tag } : c)));
    } catch {
      toast.error("태그 변경 실패");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copySelected = () => {
    const items = comments.filter((c) => selected.has(c.id));
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
        <div className="text-[13px] text-muted-foreground">피드백 로딩 중...</div>
      </div>
    );
  }

  if (loaded && comments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="text-[30px] opacity-25 mb-2">💬</div>
        <div className="text-[14px] font-bold">피드백 데이터가 없습니다</div>
        <div className="text-[13px] mt-1">설문 파일을 업로드하면 수강생 피드백이 여기에 표시됩니다</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {/* Top filter: 전체 / 플랫폼 / 강사 / 미분류 */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
          {([
            { id: "all" as const, label: `전체 (${comments.length})` },
            { id: "platform" as const, label: `플랫폼 (${platformCount})` },
            { id: "instructor" as const, label: `강사 (${instructorCount})` },
            { id: "untagged" as const, label: `미분류 (${untaggedCount})` },
          ]).map((f) => (
            <button
              key={f.id}
              onClick={() => { setViewMode(f.id); setPlatformSub("all"); }}
              className={`py-1.5 px-3.5 rounded-md text-[12px] transition-colors ${
                viewMode === f.id
                  ? "bg-card font-bold text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Platform sub-filter */}
        {viewMode === "platform" && (
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

        {/* Cohort filter */}
        {!cohort && cohortLabels.length > 1 && (
          <select
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border text-[12px] bg-card"
          >
            <option value="all">전체 기수</option>
            {cohortLabels.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        )}

        {/* Search */}
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

      {/* Grouped feedback cards */}
      <div className="grid gap-4 max-h-[calc(100vh-310px)] overflow-y-auto">
        {grouped.map(([sourceField, items]) => (
          <div key={sourceField}>
            {/* Group header */}
            <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
              <span className="text-[13px] font-bold">
                {FIELD_LABELS[sourceField] || sourceField}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {items.length}건
              </span>
              <div className="flex-1 border-b" />
            </div>

            {/* Cards */}
            <div className="grid gap-1.5">
              {items.map((comment) => {
                const isSelected = selected.has(comment.id);
                const et = effectiveTag(comment);
                const isAutoTag = comment.tag === null && et !== null;

                return (
                  <div
                    key={comment.id}
                    className={`py-2.5 px-3.5 rounded-lg border bg-card transition-colors ${
                      isSelected ? "ring-2 ring-primary/30 bg-primary/3" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <label className="mt-0.5 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(comment.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                      </label>

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] leading-relaxed">
                          {comment.original_text}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground/60">
                            {comment.respondent}
                          </span>
                          {comment.cohortLabel && (
                            <span>{comment.cohortLabel}</span>
                          )}
                        </div>
                      </div>

                      {/* Tag dropdown */}
                      <select
                        value={comment.tag || ""}
                        onChange={(e) => handleTagChange(comment.id, (e.target.value || null) as TagValue)}
                        className={`shrink-0 text-[10px] py-0.5 px-1.5 rounded border font-semibold cursor-pointer ${
                          isAutoTag ? "opacity-50 " : ""
                        }${getTagColor(et)}`}
                      >
                        <option value="">미분류</option>
                        <optgroup label="플랫폼">
                          <option value="platform_pm">PM</option>
                          <option value="platform_pd">PD</option>
                          <option value="platform_cs">CS</option>
                          <option value="platform_etc">기타</option>
                        </optgroup>
                        <option value="instructor">강사</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-[13px]">
            해당 조건의 피드백이 없습니다
          </div>
        )}
      </div>

      {/* Action bar */}
      {selected.size > 0 && (
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
