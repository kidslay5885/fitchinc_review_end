"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { Instructor, Course, Cohort, Comment, Survey } from "@/lib/types";
import {
  FIELD_LABELS,
  FIELD_ORDER,
  TAG_OPTIONS,
  getTagColor,
  getTagLabel,
  isPlatformTag,
  isUsefulComment,
  effectiveTag,
  type CommentWithCohort,
  type TagValue,
  type PlatformSub,
} from "@/lib/feedback-utils";
import { Loader2, Search, Copy, Check, X, FileText, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";

type HubView = "untagged" | "instructor" | "platform" | "all";

interface TabFeedbackHubProps {
  instructor: Instructor;
  course: Course | null;
  cohort: Cohort | null;
  platformName: string;
  readOnly?: boolean;
}

export function TabFeedbackHub({ instructor, course, cohort, platformName, readOnly }: TabFeedbackHubProps) {
  const [comments, setComments] = useState<CommentWithCohort[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [hubView, setHubView] = useState<HubView>("all");
  const [platformSub, setPlatformSub] = useState<PlatformSub>("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [sourceFieldFilter, setSourceFieldFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const [search, setSearch] = useState("");

  // 체크박스 선택 (미분류 뷰 일괄 태깅 + 강사 뷰 복사)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, { tag: TagValue; sentiment: "positive" | "negative" | "neutral" }>>({});
  // 미분류 일괄 등록 시 선택 옵션 (전달대상 + 감정 둘 다 선택 후 등록)
  const [bulkTag, setBulkTag] = useState<TagValue>("platform_pm");
  const [bulkSentiment, setBulkSentiment] = useState<"positive" | "negative" | "neutral">("positive");
  const cohortLabel = cohort?.label || null;
  const memoKey = `memo-feedback-${platformName}-${instructor.name}-${cohortLabel ?? "all"}`;
  const [memo, setMemo] = useState("");
  const memoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setMemo(localStorage.getItem(memoKey) || "");
  }, [memoKey]);
  const persistMemo = (value: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(memoKey, value);
  };
  const handleMemoChange = (value: string) => {
    setMemo(value);
    if (memoSaveRef.current) clearTimeout(memoSaveRef.current);
    memoSaveRef.current = setTimeout(() => persistMemo(value), 400);
  };

  const courseName = course?.name ?? null;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadComments();
    return () => { abortRef.current?.abort(); };
  }, [platformName, instructor.name, courseName, cohortLabel]);


  // 뷰 변경 시 선택 초기화
  useEffect(() => {
    setSelected(new Set());
  }, [hubView]);

  const clearSuggestion = (commentId: string) => {
    setAiSuggestions((prev) => {
      const next = { ...prev };
      delete next[commentId];
      return next;
    });
  };

  const updateSuggestion = (commentId: string, update: Partial<{ tag: TagValue; sentiment: "positive" | "negative" | "neutral" }>) => {
    setAiSuggestions((prev) => {
      if (!prev[commentId]) return prev;
      return { ...prev, [commentId]: { ...prev[commentId], ...update } };
    });
  };

  const fetchAiSuggestions = async () => {
    const untagged = comments.filter((c) => effectiveTag(c) === null);
    if (untagged.length === 0) {
      toast.info("미분류 항목이 없습니다");
      return;
    }
    setAiSuggestLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch("/api/suggest-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: untagged.slice(0, 50).map((c) => ({ id: c.id, original_text: c.original_text, source_field: c.source_field })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const map: Record<string, { tag: TagValue; sentiment: "positive" | "negative" | "neutral" }> = {};
      for (const s of data.suggestions || []) {
        map[s.commentId] = { tag: s.tag, sentiment: s.sentiment };
      }
      setAiSuggestions(map);
      toast.success(`AI 분류 ${Object.keys(map).length}건 완료`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.error("AI 분류 시간 초과 — 다시 시도해주세요");
      } else {
        toast.error("AI 분류 실패");
      }
    } finally {
      clearTimeout(timeout);
      setAiSuggestLoading(false);
    }
  };

  const loadComments = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        platform: platformName,
        instructor: instructor.name,
      });
      if (courseName != null) params.set("course", courseName);
      if (cohortLabel) params.set("cohort", cohortLabel);

      const res = await fetch(`/api/classify?${params}`, { signal: controller.signal });
      if (!res.ok) throw new Error();
      const data: Comment[] = await res.json();
      const useful = data.filter(isUsefulComment);

      if (!cohortLabel) {
        const surveyRes = await fetch("/api/surveys", { signal: controller.signal });
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
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error("피드백 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  // 기수 목록
  const cohortLabels = useMemo(() => {
    const labels = new Set(comments.map((c) => c.cohortLabel).filter(Boolean));
    return Array.from(labels).sort();
  }, [comments]);

  // 네이버 폼 출처 항목 (현재 데이터에 있는 source_field만, FIELD_ORDER 순)
  const sourceFieldsInData = useMemo(() => {
    const set = new Set(comments.map((c) => c.source_field));
    return FIELD_ORDER.filter((f) => set.has(f));
  }, [comments]);

  // 태그별 카운트
  const untaggedCount = comments.filter((c) => effectiveTag(c) === null).length;
  const instructorCount = comments.filter((c) => effectiveTag(c) === "instructor").length;
  const platformCount = comments.filter((c) => isPlatformTag(effectiveTag(c))).length;

  // 필터링
  const filtered = useMemo(() => {
    return comments.filter((c) => {

      const et = effectiveTag(c);

      if (hubView === "untagged" && et !== null) return false;
      if (hubView === "instructor" && et !== "instructor") return false;
      if (hubView === "platform") {
        if (!isPlatformTag(et)) return false;
        if (platformSub === "pm" && et !== "platform_pm") return false;
        if (platformSub === "pd" && et !== "platform_pd") return false;
        if (platformSub === "cs" && et !== "platform_cs") return false;
        if (platformSub === "etc" && et !== "platform_etc") return false;
      }

      if (cohortFilter !== "all" && c.cohortLabel !== cohortFilter) return false;
      if (sourceFieldFilter !== "all" && c.source_field !== sourceFieldFilter) return false;
      if (sentimentFilter !== "all") {
        const s = c.sentiment;
        if (sentimentFilter === "positive" && s !== "positive") return false;
        if (sentimentFilter === "negative" && s !== "negative") return false;
        if (sentimentFilter === "neutral" && s !== null && s !== "neutral") return false;
      }
      if (search) {
        const s = search.toLowerCase();
        if (!c.original_text.toLowerCase().includes(s) && !c.respondent.toLowerCase().includes(s))
          return false;
      }
      return true;
    });
  }, [comments, hubView, platformSub, cohortFilter, sourceFieldFilter, sentimentFilter, search]);

  const exportToExcel = () => {
    if (filtered.length === 0) {
      toast.info("내보낼 데이터가 없습니다");
      return;
    }
    const headers = ["기수", "전달대상", "감정", "설문 문항", "응답자", "원문"];
    const escape = (s: string) => {
      const t = String(s ?? "").replace(/"/g, '""');
      return t.includes(",") || t.includes('"') || t.includes("\n") ? `"${t}"` : t;
    };
    const sentimentLabel = (s: Comment["sentiment"]) => (s === "positive" ? "긍정" : s === "negative" ? "부정" : s === "neutral" ? "미구분" : "");
    const rows = filtered.map((c) => [
      (c as CommentWithCohort).cohortLabel ?? "",
      getTagLabel(effectiveTag(c)),
      sentimentLabel(c.sentiment),
      FIELD_LABELS[c.source_field] ?? c.source_field,
      c.respondent ?? "",
      c.original_text ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `피드백_${instructor.name}_${cohort?.label ?? "전체"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length}건 엑셀(CSV)로 내보냈습니다`);
  };

  type SentimentValue = "positive" | "negative" | "neutral";

  // 개별 태그 변경 (수동 → ai_classified: false)
  const handleTagChange = async (commentId: string, tag: TagValue) => {
    try {
      const res = await fetch("/api/classify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, tag, ai_classified: false }),
      });
      if (!res.ok) throw new Error();
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, tag, ai_classified: false } : c)));
      clearSuggestion(commentId);
    } catch {
      toast.error("태그 변경 실패");
    }
  };

  // 개별 긍정/부정 설정 (수동 → ai_classified: false)
  const handleSentimentChange = async (commentId: string, sentiment: SentimentValue) => {
    try {
      const res = await fetch("/api/classify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, sentiment, ai_classified: false }),
      });
      if (!res.ok) throw new Error();
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, sentiment, ai_classified: false } : c)));
      clearSuggestion(commentId);
    } catch {
      toast.error("평가 구분 저장 실패");
    }
  };

  // 일괄 태깅 (전달대상 + 감정 함께, 수동 → ai_classified: false)
  const handleBulkTagWithSentiment = async (tag: TagValue, sentiment: "positive" | "negative" | "neutral") => {
    if (selected.size === 0) return;
    setTagging(true);
    try {
      const ids = Array.from(selected);
      const results = await Promise.allSettled(
        ids.map((commentId) =>
          fetch("/api/classify", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ commentId, tag, sentiment, ai_classified: false }),
          }).then((r) => { if (!r.ok) throw new Error(); return commentId; })
        )
      );
      const successIds = new Set(
        results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled").map((r) => r.value)
      );
      const failCount = ids.length - successIds.size;
      if (successIds.size > 0) {
        setComments((prev) =>
          prev.map((c) => (successIds.has(c.id) ? { ...c, tag, sentiment, ai_classified: false } : c))
        );
      }
      if (failCount > 0) {
        toast.error(`${failCount}건 등록 실패 (${successIds.size}건 성공)`);
      } else {
        toast.success(`${ids.length}건 등록 완료`);
      }
      setSelected(new Set());
    } catch {
      toast.error("등록 실패");
    } finally {
      setTagging(false);
    }
  };

  // AI 분류 전체 적용 (ai_classified: true)
  const handleBulkApplyAi = async () => {
    const entries = Object.entries(aiSuggestions);
    if (entries.length === 0) return;
    setTagging(true);
    try {
      const results = await Promise.allSettled(
        entries.map(([commentId, { tag, sentiment }]) =>
          fetch("/api/classify", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ commentId, tag, sentiment, ai_classified: true }),
          }).then((r) => { if (!r.ok) throw new Error(); return commentId; })
        )
      );
      const successIds = new Set(
        results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled").map((r) => r.value)
      );
      const failCount = entries.length - successIds.size;
      if (successIds.size > 0) {
        setComments((prev) =>
          prev.map((c) => {
            if (!successIds.has(c.id)) return c;
            const suggestion = aiSuggestions[c.id];
            return suggestion ? { ...c, tag: suggestion.tag, sentiment: suggestion.sentiment, ai_classified: true } : c;
          })
        );
        // 성공한 건만 제안에서 제거
        setAiSuggestions((prev) => {
          const next = { ...prev };
          for (const id of successIds) delete next[id];
          return next;
        });
      }
      if (failCount > 0) {
        toast.error(`${failCount}건 실패 (${successIds.size}건 적용 완료)`);
      } else {
        toast.success(`${entries.length}건 AI 분류 적용 완료`);
        setAiSuggestions({});
      }
    } catch {
      toast.error("AI 분류 적용 실패");
    } finally {
      setTagging(false);
    }
  };

  // 복사 (강사 뷰)
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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  if (loading && !loaded) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
        <div className="text-[14px] text-muted-foreground">피드백 로딩 중...</div>
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

  // 카드 렌더링 함수
  const renderCard = (comment: CommentWithCohort) => {
    const et = effectiveTag(comment);
    const isAutoTag = comment.tag === null && et !== null;
    const isSelected = selected.has(comment.id);
    const showCheckbox = !readOnly && (hubView === "untagged" || hubView === "instructor");
    const aiSuggestion = !readOnly && hubView === "untagged" ? aiSuggestions[comment.id] : null;

    return (
      <div
        key={comment.id}
        className={`py-3 px-4 rounded-lg border bg-card transition-colors ${
          aiSuggestion ? "ring-2 ring-amber-400 bg-amber-50/50" : isSelected ? "ring-2 ring-primary/30 bg-primary/3" : ""
        }`}
      >
        <div className="flex items-start gap-2.5">
          {showCheckbox && (
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
            <p className="text-[14px] leading-relaxed">{comment.original_text}</p>
            <div className="flex items-center gap-1.5 mt-1 text-[12px] text-muted-foreground flex-wrap">
              <span className="font-semibold text-foreground/60">
                {comment.respondent}
              </span>
              {comment.cohortLabel && <span>{comment.cohortLabel}</span>}
              {hubView === "untagged" && (
                <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                  {FIELD_LABELS[comment.source_field] || comment.source_field}
                </span>
              )}
            </div>
            {/* 미분류 + AI 분류 결과: 태그·감정 버튼 그룹으로 편집 가능 */}
            {aiSuggestion && (
              <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
                <span className="font-semibold text-amber-800 shrink-0">AI:</span>
                {/* 태그 버튼 그룹 */}
                <div className="flex gap-0.5">
                  {TAG_OPTIONS.filter((o) => o.value !== "").map((opt) => {
                    const isActive = aiSuggestion.tag === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateSuggestion(comment.id, { tag: opt.value as TagValue })}
                        className={`py-0.5 px-1.5 rounded border transition-colors ${
                          isActive ? opt.color + " font-bold" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        }`}
                      >
                        {opt.label}{isActive ? "\u25CF" : ""}
                      </button>
                    );
                  })}
                </div>
                {/* 감정 버튼 그룹 */}
                <div className="flex gap-0.5">
                  {([
                    { id: "positive" as const, label: "긍정", activeClass: "bg-emerald-100 text-emerald-800 border-emerald-200" },
                    { id: "negative" as const, label: "부정", activeClass: "bg-rose-100 text-rose-800 border-rose-200" },
                    { id: "neutral" as const, label: "중립", activeClass: "bg-muted text-foreground border-border" },
                  ]).map((s) => {
                    const isActive = aiSuggestion.sentiment === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => updateSuggestion(comment.id, { sentiment: s.id })}
                        className={`py-0.5 px-1.5 rounded border transition-colors ${
                          isActive ? s.activeClass + " font-bold" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                        }`}
                      >
                        {s.label}{isActive ? "\u25CF" : ""}
                      </button>
                    );
                  })}
                </div>
                {/* 무시 */}
                <button
                  type="button"
                  onClick={() => clearSuggestion(comment.id)}
                  className="py-0.5 px-1.5 rounded text-muted-foreground border hover:bg-muted ml-auto"
                >
                  ✕ 무시
                </button>
              </div>
            )}
            {/* 분류된 댓글만: 긍정/부정 구분 */}
            {et && !readOnly && (
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[11px] text-muted-foreground mr-0.5">평가:</span>
                {(["positive", "negative", "neutral"] as const).map((s) => {
                  const cur = comment.sentiment || null;
                  const isActive = cur === s;
                  const label = s === "positive" ? "긍정" : s === "negative" ? "부정" : "구분없음";
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSentimentChange(comment.id, s)}
                      className={`py-0.5 px-1.5 rounded text-[11px] transition-colors ${
                        isActive
                          ? s === "positive"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : s === "negative"
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-muted text-foreground border border-border"
                          : "bg-muted/50 text-muted-foreground border border-transparent hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
            {/* readOnly: 감정 뱃지만 표시 */}
            {et && readOnly && comment.sentiment && (
              <div className="mt-1.5">
                <span className={`text-[11px] py-0.5 px-1.5 rounded font-semibold ${
                  comment.sentiment === "positive" ? "bg-emerald-100 text-emerald-700"
                    : comment.sentiment === "negative" ? "bg-rose-100 text-rose-700"
                      : "bg-muted text-foreground"
                }`}>
                  {comment.sentiment === "positive" ? "긍정" : comment.sentiment === "negative" ? "부정" : "구분없음"}
                </span>
              </div>
            )}
          </div>

          {/* 전체 뷰: 태그 드롭다운 (편집) / 뱃지 (읽기) */}
          {hubView === "all" && !readOnly && (
            <div className="flex items-center gap-1 shrink-0">
              {comment.ai_classified && (
                <span className="text-[9px] px-1 py-0 rounded bg-violet-100 text-violet-600 border border-violet-200 font-bold leading-[16px]">자동</span>
              )}
              <select
                value={comment.tag || ""}
                onChange={(e) =>
                  handleTagChange(comment.id, (e.target.value || null) as TagValue)
                }
                className={`text-[11px] py-0.5 px-1.5 rounded border font-semibold cursor-pointer ${
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
          )}
          {hubView === "all" && readOnly && et && (
            <div className="flex items-center gap-1 shrink-0">
              {comment.ai_classified && (
                <span className="text-[9px] px-1 py-0 rounded bg-violet-100 text-violet-600 border border-violet-200 font-bold leading-[16px]">자동</span>
              )}
              <span className={`text-[11px] py-0.5 px-1.5 rounded border font-semibold ${getTagColor(et)}`}>
                {getTagLabel(et)}
              </span>
            </div>
          )}

          {/* 강사/플랫폼 뷰: 태그 드롭다운 (편집) / 뱃지 (읽기) */}
          {(hubView === "instructor" || hubView === "platform") && !readOnly && (
            <div className="flex items-center gap-1 shrink-0">
              {comment.ai_classified && (
                <span className="text-[9px] px-1 py-0 rounded bg-violet-100 text-violet-600 border border-violet-200 font-bold leading-[16px]">자동</span>
              )}
              <select
                value={comment.tag || ""}
                onChange={(e) =>
                  handleTagChange(comment.id, (e.target.value || null) as TagValue)
                }
                className={`text-[11px] py-0.5 px-1.5 rounded border font-semibold cursor-pointer ${
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
          )}
          {(hubView === "instructor" || hubView === "platform") && readOnly && (
            <div className="flex items-center gap-1 shrink-0">
              {comment.ai_classified && (
                <span className="text-[9px] px-1 py-0 rounded bg-violet-100 text-violet-600 border border-violet-200 font-bold leading-[16px]">자동</span>
              )}
              <span
                className={`text-[11px] py-0.5 px-1.5 rounded border font-semibold ${getTagColor(et)}`}
              >
                {getTagLabel(et)}
              </span>
            </div>
          )}

        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-3">
      {/* 뷰 탭 */}
      {(
        <div className="flex flex-col gap-1.5">
          {!readOnly && (
            <div className="flex items-center gap-2 flex-wrap">
              {hubView === "untagged" && untaggedCount > 0 && (
                <button
                  type="button"
                  onClick={fetchAiSuggestions}
                  disabled={aiSuggestLoading}
                  className="flex items-center gap-1 py-1 px-2.5 rounded-md text-[12px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 disabled:opacity-50"
                >
                  {aiSuggestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  AI 자동 분류
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border w-fit">
              {([
                { id: "all" as HubView, label: `전체 ${comments.length}` },
                { id: "platform" as HubView, label: `플랫폼 ${platformCount}` },
                { id: "instructor" as HubView, label: `강사 ${instructorCount}` },
                ...(!readOnly ? [{ id: "untagged" as HubView, label: `미분류 ${untaggedCount}` }] : []),
              ]).map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setHubView(v.id);
                    setPlatformSub("all");
                  }}
                  className={`py-1.5 px-3.5 rounded-md text-[13px] transition-colors ${
                    hubView === v.id
                      ? "bg-card font-bold text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportToExcel}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[13px] font-medium border bg-card hover:bg-muted/80 text-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors"
              title="현재 보기 조건에 맞는 목록을 엑셀(CSV)로 다운로드합니다"
            >
              <Download className="w-3.5 h-3.5" />
              엑셀으로 내보내기
            </button>
          </div>
        </div>
      )}


      {/* 보조 필터 */}
      <div className="flex gap-2 items-center flex-wrap">
        {/* 플랫폼 뷰 서브필터 */}
        {hubView === "platform" && (
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
                className={`py-1 px-2.5 rounded-md text-[12px] transition-colors ${
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

        {/* 평가 구분 필터: 긍정/부정 따로 보기 (전체·긍정·부정·미구분 동일 비중, 시선상 중립) */}
        {(hubView === "instructor" || hubView === "platform" || hubView === "all") && (
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 px-1 py-0.5" title="내부 검수·전달용">
            <span className="text-[11px] text-muted-foreground mr-0.5 shrink-0">평가:</span>
            {(
              [
                { id: "all" as const, label: "전체" },
                { id: "positive" as const, label: "긍정" },
                { id: "negative" as const, label: "부정" },
                { id: "neutral" as const, label: "미구분" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSentimentFilter(opt.id)}
                className={`shrink-0 py-1 px-2 rounded-md text-[12px] transition-colors ${
                  sentimentFilter === opt.id
                    ? "bg-card font-semibold text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* 설문 문항 필터: 전체 뷰가 아닐 때만 표시 */}
        {sourceFieldsInData.length > 1 && hubView !== "all" && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[12px] font-semibold text-muted-foreground whitespace-nowrap">설문 문항</span>
            <select
              value={sourceFieldFilter}
              onChange={(e) => setSourceFieldFilter(e.target.value)}
              className="py-1.5 px-2.5 rounded-lg border text-[14px] bg-card"
              title="설문의 어떤 질문에서 수집된 응답만 볼지 선택"
            >
              <option value="all">전체 문항</option>
              {sourceFieldsInData.map((f) => (
                <option key={f} value={f}>
                  {FIELD_LABELS[f] || f}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 기수 필터 */}
        {!cohort && cohortLabels.length > 1 && (
          <select
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border text-[14px] bg-card"
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
            className="w-full py-1.5 pl-8 pr-3 rounded-lg border text-[14px] bg-card"
          />
        </div>

        <span className="text-[13px] text-muted-foreground">{filtered.length}건</span>
      </div>

      {/* 카드 리스트: 전달 대상별 플랫 리스트 (설문 문항 그룹 없음) */}
      <div className="grid gap-4 min-h-[280px] max-h-[calc(100vh-360px)] overflow-y-auto">
        <div className="grid gap-1.5">
          {filtered.map(renderCard)}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-[14px]">
            해당 조건의 피드백이 없습니다
          </div>
        )}
      </div>

      {/* 미분류 뷰: AI 전체 적용 바 (AI 제안 있을 때) */}
      {hubView === "untagged" && Object.keys(aiSuggestions).length > 0 && (
        <div className="sticky bottom-0 flex items-center gap-3 py-3 px-4 bg-amber-50 rounded-xl border border-amber-200 shadow-lg">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span className="text-[14px] font-bold text-amber-800">AI 분류 {Object.keys(aiSuggestions).length}건</span>
          <div className="flex-1" />
          {tagging && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          <button
            onClick={handleBulkApplyAi}
            disabled={tagging}
            className="py-1.5 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            전체 적용
          </button>
          <button
            onClick={() => setAiSuggestions({})}
            className="py-1.5 px-3 rounded-lg border text-[13px] text-muted-foreground hover:bg-accent transition-colors"
          >
            전체 초기화
          </button>
        </div>
      )}

      {/* 미분류 뷰: 일괄 등록 액션 바 (전달대상 + 감정 선택 후 등록하기) */}
      {hubView === "untagged" && Object.keys(aiSuggestions).length === 0 && selected.size > 0 && (
        <div className="sticky bottom-0 flex flex-col gap-3 py-3 px-4 bg-card rounded-xl border shadow-lg">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[14px] font-bold">{selected.size}건 선택</span>
            <button
              onClick={toggleSelectAll}
              className="text-[13px] text-primary font-semibold hover:underline"
            >
              {selected.size === filtered.length ? "선택 해제" : "전체 선택"}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] text-muted-foreground shrink-0">전달 대상:</span>
              {(
                [
                  { id: "platform_pm" as TagValue, label: "PM", cn: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
                  { id: "platform_pd" as TagValue, label: "PD", cn: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100" },
                  { id: "platform_cs" as TagValue, label: "CS", cn: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100" },
                  { id: "platform_etc" as TagValue, label: "기타", cn: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100" },
                  { id: "instructor" as TagValue, label: "강사", cn: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBulkTag(opt.id)}
                  disabled={tagging}
                  className={`py-1.5 px-3 rounded-lg border text-[13px] font-bold transition-colors disabled:opacity-50 ${bulkTag === opt.id ? opt.cn : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[12px] text-muted-foreground shrink-0">감정:</span>
              {(
                [
                  { id: "positive" as const, label: "긍정" },
                  { id: "negative" as const, label: "부정" },
                  { id: "neutral" as const, label: "미분류" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBulkSentiment(opt.id)}
                  disabled={tagging}
                  className={`py-1.5 px-3 rounded-lg border text-[13px] font-bold transition-colors disabled:opacity-50 ${
                    bulkSentiment === opt.id ? "bg-primary/15 text-primary border-primary/50" : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tagging && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            <button
              onClick={() => handleBulkTagWithSentiment(bulkTag, bulkSentiment)}
              disabled={tagging}
              className="py-1.5 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              등록하기
            </button>
          </div>
        </div>
      )}

      {/* 복사/확인완료 액션 바 (강사/플랫폼 뷰) */}
      {(hubView === "instructor" || hubView === "platform") && selected.size > 0 && (
        <div className="sticky bottom-0 flex items-center gap-3 py-3 px-4 bg-card rounded-xl border shadow-lg">
          <span className="text-[14px] font-bold">{selected.size}건 선택됨</span>
          <button
            onClick={toggleSelectAll}
            className="text-[13px] text-primary font-semibold hover:underline"
          >
            {selected.size === filtered.length ? "선택 해제" : "전체 선택"}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setSelected(new Set())}
            className="py-1.5 px-3 rounded-lg border text-[13px] text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            해제
          </button>
          <button
            onClick={copySelected}
            className="py-1.5 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "복사됨" : "원문 복사"}
          </button>
        </div>
      )}

      {/* 피드백 메모 (자동 저장) */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px] font-semibold">메모</span>
          <span className="text-[11px] text-muted-foreground">(자동 저장)</span>
        </div>
        <textarea
          value={memo}
          onChange={(e) => handleMemoChange(e.target.value)}
          placeholder="피드백 검수·전달 관련 메모를 적어두세요"
          className="w-full min-h-[72px] py-2 px-3 rounded-lg border text-[13px] bg-background resize-y"
          rows={3}
        />
      </div>
    </div>
  );
}
