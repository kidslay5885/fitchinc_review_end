"use client";

import { useState, useEffect, useMemo, useRef, } from "react";
import type { Comment } from "@/lib/types";
import {
  FIELD_LABELS,
  FIELD_ORDER,
  isUsefulComment,
} from "@/lib/feedback-utils";
import { useAppStore } from "@/hooks/use-app-store";
import {
  Loader2,
  Search,
  Copy,
  Check,
  X,
  Download,
  ChevronUp,
  User,
  CheckCircle2,
  EyeOff,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

type Role = "pm" | "pd" | "cs" | "instructor";

interface EnrichedComment extends Comment {
  _platform: string;
  _instructor: string;
  _cohort: string;
}

interface InstructorSummary {
  instructor: string;
  platform: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  confirmed: number;
  comments: EnrichedComment[];
}

interface RoleFeedbackViewProps {
  initialRole?: Role;
}

const ROLE_TAGS: Record<Role, string> = {
  pm: "platform_pm",
  pd: "platform_pd",
  cs: "platform_cs",
  instructor: "instructor",
};

const ROLE_LABELS: Record<Role, string> = {
  pm: "PM",
  pd: "PD",
  cs: "CS",
  instructor: "강사",
};

export function RoleFeedbackView({ initialRole = "pm" }: RoleFeedbackViewProps) {
  const { state } = useAppStore();
  const [role, setRole] = useState<Role>(initialRole);
  const [comments, setComments] = useState<EnrichedComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 상위 필터
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // 선택된 강사 (카드 클릭 → 상세)
  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);

  // 상세 뷰 내 필터
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [sourceFieldFilter, setSourceFieldFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const [detailSearch, setDetailSearch] = useState("");

  // 체크박스 + 복사
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // 확인 완료
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"unconfirmed" | "confirmed">("unconfirmed");

  // 숨긴 댓글
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

  // 상세 뷰 스크롤 ref
  const detailRef = useRef<HTMLDivElement>(null);

  // 확인 완료 목록 로드
  const loadConfirmed = async () => {
    try {
      const res = await fetch("/api/confirmed");
      if (!res.ok) return;
      const ids: string[] = await res.json();
      setConfirmedIds(new Set(ids));
    } catch { /* ignore */ }
  };

  // 숨긴 댓글 로드
  const loadHiddenComments = async () => {
    try {
      const res = await fetch("/api/app-settings");
      if (!res.ok) return;
      const d = await res.json();
      if (Array.isArray(d.hiddenComments) && d.hiddenComments.length > 0) {
        setHiddenIds(new Set(d.hiddenComments));
      }
    } catch { /* ignore */ }
  };

  // 댓글 숨기기
  const hideComment = async (commentId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(commentId);
      return next;
    });
    try {
      await fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hidden_comments", action: "add", commentId }),
      });
    } catch {
      toast.error("숨기기 저장 실패");
    }
  };

  const restoreComment = async (commentId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(commentId);
      return next;
    });
    try {
      await fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hidden_comments", action: "remove", commentId }),
      });
    } catch {
      toast.error("복원 저장 실패");
    }
  };

  const toggleConfirm = async (commentId: string) => {
    const isConfirmed = confirmedIds.has(commentId);
    try {
      const res = await fetch("/api/confirmed", {
        method: isConfirmed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentIds: [commentId] }),
      });
      if (!res.ok) throw new Error();
      setConfirmedIds((prev) => {
        const next = new Set(prev);
        if (isConfirmed) next.delete(commentId);
        else next.add(commentId);
        return next;
      });
    } catch {
      toast.error("확인 상태 변경 실패");
    }
  };

  const bulkConfirm = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    try {
      const res = await fetch("/api/confirmed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentIds: ids }),
      });
      if (!res.ok) throw new Error();
      setConfirmedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      toast.success(`${ids.length}건 확인 완료`);
      setSelected(new Set());
    } catch {
      toast.error("확인 완료 실패");
    }
  };

  // 역할 변경 시 초기화
  useEffect(() => {
    setSelected(new Set());
    setSelectedInstructor(null);
    setPlatformFilter("all");
    setSearch("");
    resetDetailFilters();
    loadComments(role);
    loadConfirmed();
    loadHiddenComments();
  }, [role]);

  const resetDetailFilters = () => {
    setCohortFilter("all");
    setSourceFieldFilter("all");
    setSentimentFilter("all");
    setDetailSearch("");
    setSelected(new Set());
    setViewMode("unconfirmed");
  };

  const loadComments = async (r: Role) => {
    setLoading(true);
    try {
      const tag = ROLE_TAGS[r];
      const res = await fetch(`/api/classify?tag=${tag}`);
      if (!res.ok) throw new Error();
      const data: EnrichedComment[] = await res.json();
      const useful = data.filter(isUsefulComment);
      setComments(useful);
      setLoaded(true);
    } catch {
      toast.error("피드백 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  // 강사 사진 맵 (store에서)
  const photoMap = useMemo(() => {
    const map = new Map<string, { photo: string; photoPosition: string }>();
    for (const platform of state.platforms) {
      for (const inst of platform.instructors) {
        map.set(`${platform.name}|${inst.name}`, {
          photo: inst.photo || "",
          photoPosition: inst.photoPosition || "center 2%",
        });
      }
    }
    return map;
  }, [state.platforms]);

  // 플랫폼 목록
  const platformLabels = useMemo(() => {
    const set = new Set(comments.map((c) => c._platform).filter(Boolean));
    return Array.from(set).sort();
  }, [comments]);

  // 숨긴 댓글 수
  const hiddenCount = useMemo(() => {
    return comments.filter((c) => hiddenIds.has(c.id)).length;
  }, [comments, hiddenIds]);

  // 강사별 요약 카드 데이터 (항상 전체 댓글 기준, 확인완료 건수 포함)
  const instructorSummaries = useMemo(() => {
    const map = new Map<string, InstructorSummary>();
    for (const c of comments) {
      if (showHidden ? !hiddenIds.has(c.id) : hiddenIds.has(c.id)) continue;
      if (platformFilter !== "all" && c._platform !== platformFilter) continue;
      const key = `${c._platform}|${c._instructor}`;
      if (!map.has(key)) {
        map.set(key, {
          instructor: c._instructor,
          platform: c._platform,
          total: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          confirmed: 0,
          comments: [],
        });
      }
      const s = map.get(key)!;
      s.total++;
      if (c.sentiment === "positive") s.positive++;
      else if (c.sentiment === "negative") s.negative++;
      else s.neutral++;
      if (confirmedIds.has(c.id)) s.confirmed++;
      s.comments.push(c);
    }
    let result = Array.from(map.values());

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.instructor.toLowerCase().includes(q) || s.platform.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => b.total - a.total);
    return result;
  }, [comments, platformFilter, search, confirmedIds, hiddenIds, showHidden]);

  const totalCount = useMemo(
    () => instructorSummaries.reduce((sum, s) => sum + s.total, 0),
    [instructorSummaries]
  );

  // 선택된 강사의 상세 데이터
  const selectedSummary = useMemo(
    () => instructorSummaries.find((s) => `${s.platform}|${s.instructor}` === selectedInstructor) || null,
    [instructorSummaries, selectedInstructor]
  );

  // 상세 뷰 기수/문항 목록
  const detailCohorts = useMemo(() => {
    if (!selectedSummary) return [];
    const set = new Set(selectedSummary.comments.map((c) => c._cohort).filter(Boolean));
    return Array.from(set).sort();
  }, [selectedSummary]);

  const detailSourceFields = useMemo(() => {
    if (!selectedSummary) return [];
    const set = new Set(selectedSummary.comments.map((c) => c.source_field));
    return FIELD_ORDER.filter((f) => set.has(f));
  }, [selectedSummary]);

  // 상세 뷰 필터링 (미확인/확인완료 탭 기준)
  const detailFiltered = useMemo(() => {
    if (!selectedSummary) return [];
    return selectedSummary.comments.filter((c) => {
      const isConfirmed = confirmedIds.has(c.id);
      if (viewMode === "unconfirmed" && isConfirmed) return false;
      if (viewMode === "confirmed" && !isConfirmed) return false;
      if (cohortFilter !== "all" && c._cohort !== cohortFilter) return false;
      if (sourceFieldFilter !== "all" && c.source_field !== sourceFieldFilter) return false;
      if (sentimentFilter !== "all") {
        if (sentimentFilter === "positive" && c.sentiment !== "positive") return false;
        if (sentimentFilter === "negative" && c.sentiment !== "negative") return false;
        if (sentimentFilter === "neutral" && c.sentiment !== null && c.sentiment !== "neutral") return false;
      }
      if (detailSearch) {
        const q = detailSearch.toLowerCase();
        if (!c.original_text.toLowerCase().includes(q) && !c.respondent.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [selectedSummary, cohortFilter, sourceFieldFilter, sentimentFilter, detailSearch, viewMode, confirmedIds]);

  // 확인완료/미확인 건수 (필터 무관하게 해당 강사 전체 기준)
  const confirmedCount = useMemo(() => {
    if (!selectedSummary) return 0;
    return selectedSummary.comments.filter((c) => confirmedIds.has(c.id)).length;
  }, [selectedSummary, confirmedIds]);
  const unconfirmedCount = useMemo(() => {
    if (!selectedSummary) return 0;
    return selectedSummary.total - confirmedCount;
  }, [selectedSummary, confirmedCount]);

  const handleCardClick = (key: string) => {
    if (selectedInstructor === key) {
      setSelectedInstructor(null);
    } else {
      setSelectedInstructor(key);
      resetDetailFilters();
      // 스크롤
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  };

  // 엑셀 내보내기
  const exportToExcel = () => {
    const data = detailFiltered;
    if (data.length === 0) {
      toast.info("내보낼 데이터가 없습니다");
      return;
    }
    const headers = ["플랫폼", "강사", "기수", "감정", "설문 문항", "응답자", "원문"];
    const escape = (s: string) => {
      const t = String(s ?? "").replace(/"/g, '""');
      return t.includes(",") || t.includes('"') || t.includes("\n") ? `"${t}"` : t;
    };
    const sentimentLabel = (s: Comment["sentiment"]) =>
      s === "positive" ? "긍정" : s === "negative" ? "부정" : s === "neutral" ? "미구분" : "";
    const rows = data.map((c) => [
      c._platform,
      c._instructor,
      c._cohort,
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
    const instName = selectedSummary?.instructor || ROLE_LABELS[role];
    a.download = `${instName}_${ROLE_LABELS[role]}_피드백_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length}건 엑셀(CSV)로 내보냈습니다`);
  };

  // 복사
  const copySelected = () => {
    const items = detailFiltered.filter((c) => selected.has(c.id));
    const text = items
      .map(
        (c) =>
          `"${c.original_text}" — ${c.respondent}${c._cohort ? `, ${c._cohort}` : ""}`
      )
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
    if (selected.size === detailFiltered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(detailFiltered.map((c) => c.id)));
    }
  };

  const positivePercent = (s: InstructorSummary) =>
    s.total > 0 ? Math.round((s.positive / s.total) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 px-8 min-w-0">
      <div className="w-full max-w-[1200px] mx-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <h1 className="text-[18px] font-extrabold">직무별 피드백</h1>
          <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
            {(["pm", "pd", "cs", "instructor"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`py-1.5 px-4 rounded-md text-[13px] font-semibold transition-colors ${
                  role === r
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => { setShowHidden((v) => !v); setSelectedInstructor(null); }}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[13px] font-medium border transition-colors ${
                showHidden
                  ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                  : "bg-card hover:bg-muted/80 text-muted-foreground"
              }`}
              title={showHidden ? "숨긴 댓글 보기 해제" : "숨긴 댓글 보기"}
            >
              {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              숨긴 댓글 {hiddenCount}건
            </button>
          )}
          <span className="text-[13px] text-muted-foreground font-semibold">
            총 {totalCount}건
          </span>
        </div>

        {/* 상위 필터 */}
        <div className="flex gap-2 items-center flex-wrap mb-5">
          {platformLabels.length > 1 && (
            <select
              value={platformFilter}
              onChange={(e) => { setPlatformFilter(e.target.value); setSelectedInstructor(null); }}
              className="py-1.5 px-2.5 rounded-lg border text-[14px] bg-card"
            >
              <option value="all">전체 플랫폼</option>
              {platformLabels.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          )}
          <div className="relative flex-1 min-w-[140px] max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="강사 검색..."
              className="w-full py-1.5 pl-8 pr-3 rounded-lg border text-[14px] bg-card"
            />
          </div>
        </div>

        {/* 로딩 */}
        {loading && !loaded && (
          <div className="text-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
            <div className="text-[14px] text-muted-foreground">피드백 로딩 중...</div>
          </div>
        )}

        {/* 데이터 없음 */}
        {loaded && comments.length === 0 && !loading && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-[30px] opacity-25 mb-2">💬</div>
            <div className="text-[14px] font-bold">{ROLE_LABELS[role]} 피드백이 없습니다</div>
            <div className="text-[13px] mt-1">
              분류작업에서 {ROLE_LABELS[role]} 태그를 지정하면 여기에 표시됩니다
            </div>
          </div>
        )}

        {/* 강사 요약 카드 그리드 */}
        {loaded && instructorSummaries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
            {instructorSummaries.map((s) => {
              const key = `${s.platform}|${s.instructor}`;
              const isActive = selectedInstructor === key;
              const pct = positivePercent(s);
              const photo = photoMap.get(key);
              return (
                <button
                  key={key}
                  onClick={() => handleCardClick(key)}
                  className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-150 text-center ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                  }`}
                >
                  {/* 강사 프로필 사진 */}
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-border/40 mb-2">
                    {photo?.photo ? (
                      <img
                        src={photo.photo}
                        alt={s.instructor}
                        className="w-full h-full object-contain"
                        style={{ objectPosition: photo.photoPosition || "center 2%" }}
                      />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-[15px] font-bold truncate w-full">{s.instructor}</span>
                  <span className="text-[12px] text-muted-foreground mt-0.5">{s.platform}</span>
                  <div className="flex items-center gap-1.5 mt-2.5 w-full">
                    <span className="text-[20px] font-extrabold text-primary">{s.total}</span>
                    <span className="text-[12px] text-muted-foreground">건</span>
                    {s.confirmed > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-emerald-600 font-semibold ml-auto">
                        <CheckCircle2 className="w-3 h-3" />{s.confirmed}
                      </span>
                    )}
                  </div>
                  {/* 긍정/부정 바 */}
                  <div className="w-full mt-2">
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                      {s.positive > 0 && (
                        <div
                          className="bg-emerald-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      {s.negative > 0 && (
                        <div
                          className="bg-rose-400 transition-all"
                          style={{ width: `${Math.round((s.negative / s.total) * 100)}%` }}
                        />
                      )}
                    </div>
                    <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
                      <span>
                        긍정 <span className="font-semibold text-emerald-600">{pct}%</span>
                      </span>
                      {s.negative > 0 && (
                        <span>
                          부정 <span className="font-semibold text-rose-500">{Math.round((s.negative / s.total) * 100)}%</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {isActive && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                      <div className="w-3 h-3 bg-primary rotate-45 rounded-sm" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 검색 결과 없음 */}
        {loaded && comments.length > 0 && instructorSummaries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-[14px]">
            해당 조건의 강사가 없습니다
          </div>
        )}

        {/* 선택된 강사 상세 피드백 */}
        {selectedSummary && (
          <div ref={detailRef} className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden">
            {/* 상세 헤더 */}
            <div className="flex items-center gap-3 py-3 px-5 bg-primary/5 border-b">
              <span className="text-[16px] font-extrabold">{selectedSummary.instructor}</span>
              <span className="text-[13px] text-muted-foreground">{selectedSummary.platform}</span>
              <span className="text-[13px] font-bold text-primary">{detailFiltered.length}건</span>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedInstructor(null)}
                className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                접기
              </button>
            </div>

            {/* 상세 필터 */}
            <div className="flex gap-2 items-center flex-wrap px-5 py-3 border-b bg-muted/20">
              {/* 확인 상태 필터 */}
              <select
                value={viewMode}
                onChange={(e) => { setViewMode(e.target.value as typeof viewMode); setSelected(new Set()); }}
                className={`py-1.5 px-2.5 rounded-lg border text-[13px] font-semibold ${
                  viewMode === "confirmed"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-card"
                }`}
              >
                <option value="unconfirmed">미확인 {unconfirmedCount}건</option>
                <option value="confirmed">확인완료 {confirmedCount}건</option>
              </select>

              {detailCohorts.length > 1 && (
                <select
                  value={cohortFilter}
                  onChange={(e) => setCohortFilter(e.target.value)}
                  className="py-1.5 px-2.5 rounded-lg border text-[13px] bg-card"
                >
                  <option value="all">전체 기수</option>
                  {detailCohorts.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              )}

              {detailSourceFields.length > 1 && (
                <select
                  value={sourceFieldFilter}
                  onChange={(e) => setSourceFieldFilter(e.target.value)}
                  className="py-1.5 px-2.5 rounded-lg border text-[13px] bg-card"
                >
                  <option value="all">전체 문항</option>
                  {detailSourceFields.map((f) => (
                    <option key={f} value={f}>{FIELD_LABELS[f] || f}</option>
                  ))}
                </select>
              )}

              <select
                value={sentimentFilter}
                onChange={(e) => setSentimentFilter(e.target.value as typeof sentimentFilter)}
                className="py-1.5 px-2.5 rounded-lg border text-[13px] bg-card"
              >
                <option value="all">전체 평가</option>
                <option value="positive">긍정</option>
                <option value="negative">부정</option>
                <option value="neutral">미구분</option>
              </select>

              <button
                type="button"
                onClick={exportToExcel}
                disabled={detailFiltered.length === 0}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[12px] font-medium border bg-card hover:bg-muted/80 text-foreground disabled:opacity-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                엑셀
              </button>

              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={copySelected}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[12px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "복사됨" : `${selected.size}건 복사`}
                </button>
              )}

              <div className="relative flex-1 min-w-[100px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <input
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  placeholder="내용 검색..."
                  className="w-full py-1.5 pl-7 pr-3 rounded-lg border text-[13px] bg-card"
                />
              </div>
            </div>

            {/* 피드백 리스트 */}
            <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
              {detailFiltered.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-[14px]">
                  {viewMode === "confirmed"
                    ? "확인 완료된 피드백이 없습니다"
                    : "해당 조건의 피드백이 없습니다"}
                </div>
              )}
              <div className="grid gap-1 px-5 py-3">
                {detailFiltered.map((comment) => {
                  const isChecked = selected.has(comment.id);
                  const isConfirmed = confirmedIds.has(comment.id);
                  return (
                    <div
                      key={comment.id}
                      className={`py-2.5 px-3 rounded-lg border transition-colors ${
                        isConfirmed ? "opacity-50 bg-emerald-50/30" :
                        isChecked ? "ring-2 ring-primary/30 bg-primary/3" : "bg-background"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <label className="mt-0.5 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(comment.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          />
                        </label>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] leading-relaxed">{comment.original_text}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-[12px] text-muted-foreground flex-wrap">
                            <span className="font-semibold text-foreground/60">{comment.respondent}</span>
                            {comment._cohort && (
                              <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{comment._cohort}</span>
                            )}
                            <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                              {FIELD_LABELS[comment.source_field] || comment.source_field}
                            </span>
                            {comment.sentiment && (
                              <span
                                className={`text-[11px] py-0.5 px-1.5 rounded font-semibold ${
                                  comment.sentiment === "positive"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : comment.sentiment === "negative"
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-muted text-foreground"
                                }`}
                              >
                                {comment.sentiment === "positive" ? "긍정" : comment.sentiment === "negative" ? "부정" : "미구분"}
                              </span>
                            )}
                          </div>
                        </div>
                        {showHidden ? (
                          <button
                            type="button"
                            onClick={() => restoreComment(comment.id)}
                            title="이 댓글 복원"
                            className="shrink-0 p-1 rounded text-amber-600 hover:text-emerald-600 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => hideComment(comment.id)}
                              title="이 댓글 숨기기"
                              className="shrink-0 p-1 rounded text-muted-foreground/40 hover:text-rose-500 transition-colors"
                            >
                              <EyeOff className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleConfirm(comment.id)}
                              title={isConfirmed ? "확인 완료 해제" : "확인 완료"}
                              className={`shrink-0 p-1 rounded transition-colors ${
                                isConfirmed
                                  ? "text-emerald-600 hover:text-emerald-800"
                                  : "text-muted-foreground/40 hover:text-emerald-600"
                              }`}
                            >
                              <CheckCircle2 className="w-4.5 h-4.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 선택 액션 바 */}
            {selected.size > 0 && (
              <div className="flex items-center gap-3 py-3 px-5 border-t bg-muted/30">
                <span className="text-[13px] font-bold">{selected.size}건 선택됨</span>
                <button
                  onClick={toggleSelectAll}
                  className="text-[12px] text-primary font-semibold hover:underline"
                >
                  {selected.size === detailFiltered.length ? "선택 해제" : "전체 선택"}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setSelected(new Set())}
                  className="py-1 px-2.5 rounded-lg border text-[12px] text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  해제
                </button>
                <button
                  onClick={bulkConfirm}
                  className="py-1 px-3 rounded-lg bg-emerald-600 text-white text-[12px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  확인 완료
                </button>
                <button
                  onClick={copySelected}
                  className="py-1 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "복사됨" : "원문 복사"}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
