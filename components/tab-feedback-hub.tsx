"use client";

import { useState, useEffect, useMemo } from "react";
import type { Instructor, Cohort, Comment, Survey } from "@/lib/types";
import {
  FIELD_LABELS,
  FIELD_ORDER,
  TAG_OPTIONS,
  getTagColor,
  getTagLabel,
  isPlatformTag,
  isUsefulComment,
  effectiveTag,
  groupByField,
  type CommentWithCohort,
  type TagValue,
  type PlatformSub,
} from "@/lib/feedback-utils";
import { Loader2, Search, Copy, Check, X, Send } from "lucide-react";
import { toast } from "sonner";

type HubView = "untagged" | "instructor" | "platform" | "all";

interface TabFeedbackHubProps {
  instructor: Instructor;
  cohort: Cohort | null;
  platformName: string;
}

export function TabFeedbackHub({ instructor, cohort, platformName }: TabFeedbackHubProps) {
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
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const cohortLabel = cohort?.label || null;
  const deliveryDoneKey = `delivery-done-${platformName}-${instructor.name}-${cohortLabel ?? "all"}`;
  const [deliveryDone, setDeliveryDoneState] = useState(false);
  const setDeliveryDone = (v: boolean) => {
    setDeliveryDoneState(v);
    if (typeof window !== "undefined") {
      if (v) localStorage.setItem(deliveryDoneKey, "1");
      else localStorage.removeItem(deliveryDoneKey);
    }
  };
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDeliveryDoneState(localStorage.getItem(deliveryDoneKey) === "1");
  }, [deliveryDoneKey]);

  useEffect(() => {
    loadComments();
  }, [platformName, instructor.name, cohortLabel]);

  // 뷰 변경 시 선택 초기화
  useEffect(() => {
    setSelected(new Set());
  }, [hubView]);

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
      setLastLoadedAt(new Date());
    } catch {
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
  const platformPmCount = comments.filter((c) => effectiveTag(c) === "platform_pm").length;
  const platformPdCount = comments.filter((c) => effectiveTag(c) === "platform_pd").length;
  const platformCsCount = comments.filter((c) => effectiveTag(c) === "platform_cs").length;
  const platformEtcCount = comments.filter((c) => effectiveTag(c) === "platform_etc").length;
  const isReviewComplete = untaggedCount === 0;

  // 태그별 긍정/부정/기타 건수 (전달 요약용)
  const sentimentByTag = useMemo(() => {
    const acc: Record<string, { positive: number; negative: number; other: number }> = {};
    const tags: TagValue[] = ["instructor", "platform_pm", "platform_pd", "platform_cs", "platform_etc"];
    tags.forEach((t) => { if (t) acc[t] = { positive: 0, negative: 0, other: 0 }; });
    comments.forEach((c) => {
      const et = effectiveTag(c);
      if (!et || !acc[et]) return;
      const s = c.sentiment;
      if (s === "positive") acc[et].positive++;
      else if (s === "negative") acc[et].negative++;
      else acc[et].other++;
    });
    return acc;
  }, [comments]);

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

  // 그룹핑: 강사/플랫폼 뷰에서는 source_field별 그룹, 미분류/전체는 플랫 리스트
  const grouped = useMemo(() => {
    if (hubView === "instructor" || hubView === "platform") {
      return groupByField(filtered);
    }
    return null; // 플랫 리스트
  }, [filtered, hubView]);

  type SentimentValue = "positive" | "negative" | "neutral";

  // 개별 태그 변경
  const handleTagChange = async (commentId: string, tag: TagValue) => {
    try {
      const res = await fetch("/api/classify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, tag }),
      });
      if (!res.ok) throw new Error();
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, tag } : c)));
    } catch {
      toast.error("태그 변경 실패");
    }
  };

  // 개별 긍정/부정 설정 (전달 요약에 반영)
  const handleSentimentChange = async (commentId: string, sentiment: SentimentValue) => {
    try {
      const res = await fetch("/api/classify", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, sentiment }),
      });
      if (!res.ok) throw new Error();
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, sentiment } : c)));
    } catch {
      toast.error("평가 구분 저장 실패");
    }
  };

  // 일괄 태깅
  const handleBulkTag = async (tag: TagValue) => {
    if (selected.size === 0) return;
    setTagging(true);
    try {
      const ids = Array.from(selected);
      await Promise.all(
        ids.map((commentId) =>
          fetch("/api/classify", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ commentId, tag }),
          })
        )
      );
      setComments((prev) =>
        prev.map((c) => (selected.has(c.id) ? { ...c, tag } : c))
      );
      toast.success(`${ids.length}건 일괄 태깅 완료`);
      setSelected(new Set());
    } catch {
      toast.error("일괄 태깅 실패");
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
    const showCheckbox = hubView === "untagged" || hubView === "instructor";

    return (
      <div
        key={comment.id}
        className={`py-3 px-4 rounded-lg border bg-card transition-colors ${
          isSelected ? "ring-2 ring-primary/30 bg-primary/3" : ""
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
              {(hubView === "untagged" || hubView === "all") && (
                <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                  {FIELD_LABELS[comment.source_field] || comment.source_field}
                </span>
              )}
            </div>
            {/* 분류된 댓글만: 긍정/부정 구분 (전달 요약에 반영, 번잡하지 않게 한 줄) */}
            {et && (
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
          </div>

          {/* 전체 뷰: 태그 드롭다운 */}
          {hubView === "all" && (
            <select
              value={comment.tag || ""}
              onChange={(e) =>
                handleTagChange(comment.id, (e.target.value || null) as TagValue)
              }
              className={`shrink-0 text-[11px] py-0.5 px-1.5 rounded border font-semibold cursor-pointer ${
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
          )}

          {/* 강사/플랫폼 뷰: 읽기 전용 태그 뱃지 */}
          {(hubView === "instructor" || hubView === "platform") && (
            <span
              className={`shrink-0 text-[11px] py-0.5 px-1.5 rounded border font-semibold ${getTagColor(et)}`}
            >
              {getTagLabel(et)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
        <div className="grid gap-3 min-w-0">
      {/* 뷰 전환 */}
      <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border w-fit">
        {([
          { id: "all" as HubView, label: `전체 ${comments.length}` },
          { id: "platform" as HubView, label: `플랫폼 ${platformCount}` },
          { id: "instructor" as HubView, label: `강사 ${instructorCount}` },
          { id: "untagged" as HubView, label: `미분류 ${untaggedCount}` },
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

        {/* 네이버 폼 출처 항목 필터 */}
        {sourceFieldsInData.length > 1 && (
          <select
            value={sourceFieldFilter}
            onChange={(e) => setSourceFieldFilter(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border text-[14px] bg-card shrink-0"
            title="네이버 폼 항목별로 보기"
          >
            <option value="all">전체 출처</option>
            {sourceFieldsInData.map((f) => (
              <option key={f} value={f}>
                {FIELD_LABELS[f] || f}
              </option>
            ))}
          </select>
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

      {/* 카드 리스트: 결과 없을 때도 높이 유지해 레이아웃 넓어짐 방지 */}
      <div className="grid gap-4 min-h-[280px] max-h-[calc(100vh-360px)] overflow-y-auto">
        {grouped ? (
          // 강사/플랫폼 뷰: 그룹핑
          grouped.map(([sourceField, items]) => (
            <div key={sourceField}>
              <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
                <span className="text-[14px] font-bold">
                  {FIELD_LABELS[sourceField] || sourceField}
                </span>
                <span className="text-[12px] text-muted-foreground">{items.length}건</span>
                <div className="flex-1 border-b" />
              </div>
              <div className="grid gap-1.5">
                {items.map(renderCard)}
              </div>
            </div>
          ))
        ) : (
          // 미분류/전체 뷰: 플랫 리스트
          <div className="grid gap-1.5">
            {filtered.map(renderCard)}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-[14px]">
            해당 조건의 피드백이 없습니다
          </div>
        )}
      </div>

      {/* 미분류 뷰: 일괄 태깅 액션 바 */}
      {hubView === "untagged" && selected.size > 0 && (
        <div className="sticky bottom-0 flex items-center gap-3 py-3 px-4 bg-card rounded-xl border shadow-lg">
          <span className="text-[14px] font-bold">{selected.size}건 선택</span>
          <button
            onClick={toggleSelectAll}
            className="text-[13px] text-primary font-semibold hover:underline"
          >
            {selected.size === filtered.length ? "선택 해제" : "전체 선택"}
          </button>
          <div className="flex-1" />
          {tagging && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          <button
            onClick={() => handleBulkTag("platform_pm")}
            disabled={tagging}
            className="py-1.5 px-3 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[13px] font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            PM
          </button>
          <button
            onClick={() => handleBulkTag("platform_pd")}
            disabled={tagging}
            className="py-1.5 px-3 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[13px] font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            PD
          </button>
          <button
            onClick={() => handleBulkTag("platform_cs")}
            disabled={tagging}
            className="py-1.5 px-3 rounded-lg bg-cyan-50 text-cyan-700 border border-cyan-200 text-[13px] font-bold hover:bg-cyan-100 transition-colors disabled:opacity-50"
          >
            CS
          </button>
          <button
            onClick={() => handleBulkTag("platform_etc")}
            disabled={tagging}
            className="py-1.5 px-3 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 text-[13px] font-bold hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            기타
          </button>
          <button
            onClick={() => handleBulkTag("instructor")}
            disabled={tagging}
            className="py-1.5 px-3 rounded-lg bg-orange-50 text-orange-700 border border-orange-200 text-[13px] font-bold hover:bg-orange-100 transition-colors disabled:opacity-50"
          >
            강사
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="py-1.5 px-3 rounded-lg border text-[13px] text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            해제
          </button>
        </div>
      )}

      {/* 강사 뷰: 복사 액션 바 */}
      {hubView === "instructor" && selected.size > 0 && (
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
        </div>

        {/* 오른쪽(데스크톱) / 상단(모바일): 전달 요약 (PM 한눈에 보기) — 폭 고정으로 결과 없을 때 넓어짐 방지 */}
        <div className="order-first lg:order-2 w-full lg:w-[260px] lg:min-w-[260px] lg:max-w-[260px] lg:shrink-0">
          <div className="sticky top-4 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-3">
              <Send className="w-4 h-4 text-primary" />
              <span className="text-[14px] font-bold">전달 요약</span>
            </div>
            <div className="grid gap-2.5 text-[13px]">
              {([
                { key: "instructor" as const, label: "강사", count: instructorCount },
                { key: "platform_pm" as const, label: "플랫폼 PM", count: platformPmCount },
                { key: "platform_pd" as const, label: "플랫폼 PD", count: platformPdCount },
                { key: "platform_cs" as const, label: "플랫폼 CS", count: platformCsCount },
                { key: "platform_etc" as const, label: "플랫폼 기타", count: platformEtcCount },
              ]).map(({ key, label, count }) => {
                const s = sentimentByTag[key];
                const hasSentiment = s && (s.positive > 0 || s.negative > 0);
                return (
                  <div key={key} className="flex flex-col gap-0.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold">{count}건</span>
                    </div>
                    {hasSentiment && (
                      <div className="text-[11px] text-muted-foreground pl-0.5 flex gap-2">
                        {s!.positive > 0 && <span className="text-emerald-600">긍정 {s!.positive}</span>}
                        {s!.negative > 0 && <span className="text-rose-600">부정 {s!.negative}</span>}
                        {s!.other > 0 && <span>구분없음 {s!.other}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="border-t pt-2 mt-1 flex justify-between">
                <span className="text-muted-foreground">미분류</span>
                <span className={`font-semibold ${untaggedCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {untaggedCount}건
                </span>
              </div>
            </div>
            <div className={`mt-3 py-2 px-3 rounded-lg text-center text-[13px] font-semibold ${isReviewComplete ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
              {isReviewComplete ? "검수 완료 · 전달 가능" : "미분류 처리 후 전달"}
            </div>
            <label className="mt-2.5 flex items-center gap-2 cursor-pointer text-[12px] text-muted-foreground">
              <input
                type="checkbox"
                checked={deliveryDone}
                onChange={(e) => setDeliveryDone(e.target.checked)}
                className="rounded border-gray-300 text-primary"
              />
              전달 완료 (기록)
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground/80">
              기준: {lastLoadedAt ? (() => {
                const min = Math.floor((Date.now() - lastLoadedAt.getTime()) / 60000);
                if (min < 1) return "방금 전";
                if (min < 60) return `${min}분 전`;
                const h = Math.floor(min / 60);
                return `${h}시간 전`;
              })() : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
