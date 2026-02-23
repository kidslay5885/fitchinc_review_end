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

type TagValue = "platform" | "instructor" | null;

// pSat(만족스러운 점), pRec(추천 의향)은 피드백 원문으로 가치 없음
// → 이미 데이터 탭에서 수치 집계로 사용됨
const EXCLUDED_FIELDS = new Set(["pSat", "pRec"]);

// 짧은/의미없는 응답 필터
const NOISE_RE = /^(네|예|아니요|없습니다|없음|감사합니다|고맙습니다|좋습니다|좋았습니다|잘 모르겠습니다|모르겠습니다|특별히 없습니다|딱히 없습니다|아직 없습니다|글쎄요|x|X|-|강의 내용|커리큘럼|피드백|추천합니다|네 추천합니다|예 추천합니다|네 너무 좋습니다|[.\s]*)$/;

function isUsefulComment(c: { original_text: string; source_field: string }): boolean {
  if (EXCLUDED_FIELDS.has(c.source_field)) return false;
  const text = c.original_text.trim();
  if (text.length < 5) return false;
  if (NOISE_RE.test(text)) return false;
  return true;
}

interface CommentWithCohort extends Comment {
  cohortLabel?: string;
}

export function TabFeedbackHub({ instructor, cohort, platformName }: TabFeedbackHubProps) {
  const [comments, setComments] = useState<CommentWithCohort[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Filters
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "positive" | "negative">("all");
  const [tagFilter, setTagFilter] = useState<"all" | "platform" | "instructor" | "none">("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const cohortLabel = cohort?.label || null;

  // Load comments when instructor/cohort changes
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
      if (cohortLabel) {
        params.set("cohort", cohortLabel);
      }

      const res = await fetch(`/api/classify?${params}`);
      if (!res.ok) throw new Error();
      const data: Comment[] = await res.json();

      // 의미 없는 댓글 필터링 (pSat, pRec, 노이즈)
      const useful = data.filter(isUsefulComment);

      // If viewing all cohorts, enrich with cohort labels
      if (!cohortLabel) {
        const surveyRes = await fetch("/api/surveys");
        if (surveyRes.ok) {
          const surveys: Survey[] = await surveyRes.json();
          const surveyMap = new Map(surveys.map((s) => [s.id, s.cohort || ""]));
          const enriched: CommentWithCohort[] = useful.map((c) => ({
            ...c,
            cohortLabel: surveyMap.get(c.survey_id) || "",
          }));
          setComments(enriched);
        } else {
          setComments(useful);
        }
      } else {
        setComments(useful.map((c) => ({ ...c, cohortLabel: cohortLabel })));
      }

      setLoaded(true);
    } catch {
      toast.error("피드백 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  // Available cohort labels for filter
  const cohortLabels = useMemo(() => {
    const labels = new Set(comments.map((c) => c.cohortLabel).filter(Boolean));
    return Array.from(labels).sort();
  }, [comments]);

  // Filtered comments
  const filtered = useMemo(() => {
    return comments.filter((c) => {
      if (sentimentFilter === "positive" && c.sentiment !== "positive") return false;
      if (sentimentFilter === "negative" && c.sentiment !== "negative") return false;
      if (tagFilter === "platform" && c.tag !== "platform") return false;
      if (tagFilter === "instructor" && c.tag !== "instructor") return false;
      if (tagFilter === "none" && c.tag !== null) return false;
      if (cohortFilter !== "all" && c.cohortLabel !== cohortFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !c.original_text.toLowerCase().includes(s) &&
          !c.respondent.toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [comments, sentimentFilter, tagFilter, cohortFilter, search]);

  // Counts
  const positiveCount = comments.filter((c) => c.sentiment === "positive").length;
  const negativeCount = comments.filter((c) => c.sentiment === "negative").length;
  const platformTagCount = comments.filter((c) => c.tag === "platform").length;
  const instructorTagCount = comments.filter((c) => c.tag === "instructor").length;
  const untaggedCount = comments.filter((c) => !c.tag).length;

  const handleTagChange = async (commentId: string, tag: TagValue) => {
    try {
      await fetch("/api/classify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, tag }),
      });
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, tag } : c))
      );
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

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const copySelected = () => {
    const items = comments.filter((c) => selected.has(c.id));
    const text = items
      .map(
        (c) =>
          `"${c.original_text}" — ${c.respondent}${c.cohortLabel ? `, ${c.cohortLabel}` : ""}`
      )
      .join("\n\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.success(`${items.length}건 복사됨`);
    setTimeout(() => setCopied(false), 2000);
  };

  const borderColor = (tag: TagValue) => {
    if (tag === "platform") return "border-l-blue-500";
    if (tag === "instructor") return "border-l-orange-500";
    return "border-l-gray-300";
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
        <div className="text-[13px] mt-1">
          설문 파일을 업로드하면 수강생 피드백이 여기에 표시됩니다
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3.5">
      {/* Summary bar */}
      <div className="flex items-center gap-3 py-2.5 px-4 bg-card rounded-xl border text-[12px]">
        <span className="font-bold">전체 {comments.length}건</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-emerald-600 font-semibold">긍정 {positiveCount}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-red-600 font-semibold">부정 {negativeCount}</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-blue-600 font-semibold">플랫폼용 {platformTagCount}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-orange-600 font-semibold">강사용 {instructorTagCount}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-gray-500 font-semibold">미분류 {untaggedCount}</span>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 items-center flex-wrap">
        {/* Sentiment filter */}
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
          {(
            [
              { id: "all", label: "전체" },
              { id: "positive", label: "긍정" },
              { id: "negative", label: "부정" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setSentimentFilter(f.id)}
              className={`py-1.5 px-3 rounded-md text-[12px] transition-colors ${
                sentimentFilter === f.id
                  ? "bg-card font-bold text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tag filter */}
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
          {(
            [
              { id: "all", label: "전체" },
              { id: "platform", label: "플랫폼용" },
              { id: "instructor", label: "강사용" },
              { id: "none", label: "미분류" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setTagFilter(f.id)}
              className={`py-1.5 px-3 rounded-md text-[12px] transition-colors ${
                tagFilter === f.id
                  ? "bg-card font-bold text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Cohort filter (only when viewing all) */}
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

      {/* Feedback cards */}
      <div className="grid gap-2 max-h-[calc(100vh-340px)] overflow-y-auto">
        {filtered.map((comment) => {
          const isSelected = selected.has(comment.id);
          const sentimentLabel =
            comment.sentiment === "positive" ? "긍정" : comment.sentiment === "negative" ? "부정" : "중립";
          const sentimentStyle =
            comment.sentiment === "positive"
              ? "text-emerald-600"
              : comment.sentiment === "negative"
              ? "text-red-600"
              : "text-gray-500";

          return (
            <div
              key={comment.id}
              className={`p-3.5 rounded-xl border border-l-[3px] ${borderColor(comment.tag)} bg-card transition-colors ${
                isSelected ? "ring-2 ring-primary/30 bg-primary/3" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <label className="mt-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(comment.id)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </label>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] leading-relaxed mb-1.5">
                    {comment.original_text}
                  </p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-bold text-foreground/70">
                      {comment.respondent}
                    </span>
                    {comment.cohortLabel && (
                      <span className="text-muted-foreground">
                        {comment.cohortLabel}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {comment.source_field === "hopePlatform"
                        ? "플랫폼 요청"
                        : comment.source_field === "hopeInstructor"
                        ? "강사 요청"
                        : comment.source_field === "pFree"
                        ? "후기"
                        : comment.source_field}
                    </span>
                    <span className={`font-semibold ${sentimentStyle}`}>
                      {sentimentLabel}
                    </span>
                  </div>
                </div>

                {/* Tag dropdown */}
                <select
                  value={comment.tag || ""}
                  onChange={(e) =>
                    handleTagChange(
                      comment.id,
                      (e.target.value || null) as TagValue
                    )
                  }
                  className={`shrink-0 text-[11px] py-1 px-2 rounded-md border font-semibold cursor-pointer ${
                    comment.tag === "platform"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : comment.tag === "instructor"
                      ? "bg-orange-50 text-orange-700 border-orange-200"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  <option value="">미분류</option>
                  <option value="platform">플랫폼용</option>
                  <option value="instructor">강사용</option>
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action bar (when selected) */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 flex items-center gap-3 py-3 px-4 bg-card rounded-xl border shadow-lg">
          <span className="text-[13px] font-bold">{selected.size}건 선택됨</span>
          <button
            onClick={selectAll}
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
            선택 해제
          </button>
          <button
            onClick={copySelected}
            className="py-1.5 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "복사됨" : "원문 복사"}
          </button>
        </div>
      )}
    </div>
  );
}
