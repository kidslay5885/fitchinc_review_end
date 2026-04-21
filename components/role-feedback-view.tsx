"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { Comment } from "@/lib/types";
import {
  FIELD_LABELS,
  FIELD_ORDER,
  isUsefulComment,
} from "@/lib/feedback-utils";
import { useAppStore } from "@/hooks/use-app-store";
import { getAppSettings } from "@/lib/app-settings-cache";
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
  Share2,
  Star,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { ShareLinkDialog } from "@/components/share-link-dialog";

type Role = "pm" | "pd" | "cs" | "platform" | "etc" | "instructor";
type ViewRole = Role | "all";

interface EnrichedComment extends Comment {
  _platform: string;
  _instructor: string;
  _course: string;
  _cohort: string;
}

interface InstructorSummary {
  instructor: string;
  platform: string;
  courses: string[];
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  confirmed: number;
  starred: number;
  comments: EnrichedComment[];
}

interface RoleFeedbackViewProps {
  initialRole?: Role;
}

const ROLE_TAGS: Record<Role, string> = {
  pm: "platform_pm",
  pd: "platform_pd",
  cs: "platform_cs",
  platform: "platform_general",
  etc: "platform_etc",
  instructor: "instructor",
};

const ROLE_LABELS: Record<Role, string> = {
  pm: "PM",
  pd: "PD",
  cs: "CS",
  platform: "플랫폼",
  etc: "기타",
  instructor: "강사",
};

const VIEW_ROLE_LABELS: Record<ViewRole, string> = {
  ...ROLE_LABELS,
  all: "전체",
};

const ALL_ROLES: Role[] = ["pm", "pd", "cs", "platform", "etc", "instructor"];

// tag → Role 역매핑
const TAG_TO_ROLE: Record<string, Role> = Object.fromEntries(
  Object.entries(ROLE_TAGS).map(([r, t]) => [t, r as Role])
) as Record<string, Role>;

const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  핏크닉: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  머니업클래스: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};
const DEFAULT_PLATFORM_COLOR = { bg: "bg-muted", text: "text-foreground", border: "border-border" };

export function RoleFeedbackView({ initialRole = "pm" }: RoleFeedbackViewProps) {
  const { state } = useAppStore();
  const [role, setRole] = useState<ViewRole>(initialRole);
  const [comments, setComments] = useState<EnrichedComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 상위 필터
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // 선택된 강사 (카드 클릭 → 상세)
  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);

  // 완료 강사 숨김 토글
  const [showCompleted, setShowCompleted] = useState(false);

  // 상세 뷰 내 필터
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [cohortFilter, setCohortFilter] = useState<string>("all");
  const [sourceFieldFilter, setSourceFieldFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const [detailSearch, setDetailSearch] = useState("");

  // 체크박스 + 복사
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // 확인 완료
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"unconfirmed" | "confirmed" | "starred">("unconfirmed");

  // 중요 표시 (별표)
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // 처리 완료 판정: 직무별 피드백에서 확인했거나 액션 분류에서 process_status가 설정된 경우
  const isDone = (c: { id: string; process_status?: string | null }) =>
    confirmedIds.has(c.id) || (c.process_status != null);

  // 이관 출처
  const [transferOrigins, setTransferOrigins] = useState<Record<string, string>>({});
  // 이관 드롭다운 (개별: commentId, 다중: "__bulk__")
  const [transferDropdownId, setTransferDropdownId] = useState<string | null>(null);
  const transferDropdownRef = useRef<HTMLDivElement>(null);

  // 공유 링크 다이얼로그
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDialogTarget, setShareDialogTarget] = useState<{ platform: string; instructor: string } | null>(null);

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

  // 중요 표시 로드
  const loadStarredComments = async () => {
    try {
      const d = await getAppSettings();
      if (Array.isArray(d.starredComments) && d.starredComments.length > 0) {
        setStarredIds(new Set(d.starredComments));
      }
    } catch { /* ignore */ }
  };

  // 이관 출처 로드
  const loadTransferOrigins = async () => {
    try {
      const d = await getAppSettings();
      if (d.transferOrigins && typeof d.transferOrigins === "object") {
        setTransferOrigins(d.transferOrigins);
      }
    } catch { /* ignore */ }
  };

  // 댓글의 실제 태그 추론 (auto-mapped 댓글용)
  const getEffectiveTag = useCallback((comment: EnrichedComment): string => {
    if (comment.tag) return comment.tag;
    const autoMap: Record<string, string> = {
      hopeInstructor: "instructor", selectReason: "instructor",
      satOther: "instructor", lowScoreReason: "instructor", lowFeedbackRequest: "instructor",
      hopePlatform: "platform_general", pFree: "platform_etc",
    };
    return autoMap[comment.source_field] || "instructor";
  }, []);

  // 이관 실행
  const transferComments = useCallback(async (commentIds: string[], toRole: Role) => {
    const toTag = ROLE_TAGS[toRole];

    // 1) 각 댓글의 tag 변경
    const results = await Promise.allSettled(
      commentIds.map((id) =>
        fetch("/api/classify", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId: id, tag: toTag }),
        })
      )
    );
    const succeeded = commentIds.filter((_, i) => results[i].status === "fulfilled");
    if (succeeded.length === 0) {
      toast.error("이관 실패");
      return;
    }

    // 2) 이관 출처 저장 — "all" 모드에서는 각 댓글의 실제 tag 사용
    const commentMap = new Map(comments.map(c => [c.id, c]));
    const entries = Object.fromEntries(succeeded.map((id) => {
      if (role === "all") {
        const c = commentMap.get(id);
        return [id, c ? getEffectiveTag(c) : "instructor"];
      }
      return [id, ROLE_TAGS[role]];
    }));
    await fetch("/api/app-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "comment_transfers", action: "add", entries }),
    }).catch(() => {});

    // 3) 로컬 상태 업데이트
    setComments((prev) => prev.filter((c) => !succeeded.includes(c.id)));
    toast.success(`${succeeded.length}건을 ${ROLE_LABELS[toRole]}(으)로 이관했습니다`);
    setSelected(new Set());
    setTransferDropdownId(null);
  }, [role, comments, getEffectiveTag]);

  // 외부 클릭 시 이관 드롭다운 닫기
  useEffect(() => {
    if (!transferDropdownId) return;
    const handleClick = (e: MouseEvent) => {
      if (transferDropdownRef.current && !transferDropdownRef.current.contains(e.target as Node)) {
        setTransferDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [transferDropdownId]);

  // 중요 표시 토글 (별표 시 자동 확인완료 + 미확인 목록에서 제거)
  const toggleStar = async (commentId: string) => {
    const isStarred = starredIds.has(commentId);
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (isStarred) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    // 별표 추가 시 확인완료 처리
    if (!isStarred) {
      setConfirmedIds((prev) => {
        const next = new Set(prev);
        next.add(commentId);
        return next;
      });
      fetch("/api/confirmed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentIds: [commentId] }),
      }).catch(() => {});
    }
    fetch("/api/app-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "starred_comments", action: isStarred ? "remove" : "add", commentId }),
    }).catch(() => toast.error("중요 표시 저장 실패"));
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
    // 이전 역할의 댓글이 새 역할에서 보이지 않도록 즉시 초기화
    setComments([]);
    setLoaded(false);
    loadComments(role);
    loadConfirmed();
    loadStarredComments();
    loadTransferOrigins();
  }, [role]);

  const resetDetailFilters = () => {
    setCourseFilter("all");
    setCohortFilter("all");
    setSourceFieldFilter("all");
    setSentimentFilter("all");
    setDetailSearch("");
    setSelected(new Set());
    setViewMode("unconfirmed");
  };

  const loadComments = async (r: ViewRole) => {
    setLoading(true);
    try {
      if (r === "all") {
        const results = await Promise.all(
          ALL_ROLES.map(role =>
            fetch(`/api/classify?tag=${ROLE_TAGS[role]}`)
              .then(res => { if (!res.ok) throw new Error(); return res.json(); })
          )
        );
        const all: EnrichedComment[] = results.flat();
        const seen = new Set<string>();
        const unique = all.filter(c => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        });
        setComments(unique.filter(isUsefulComment));
      } else {
        const tag = ROLE_TAGS[r];
        const res = await fetch(`/api/classify?tag=${tag}`);
        if (!res.ok) throw new Error();
        const data: EnrichedComment[] = await res.json();
        setComments(data.filter(isUsefulComment));
      }
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

  // 강사별 요약 카드 데이터 (항상 전체 댓글 기준, 확인완료 건수 포함)
  const instructorSummaries = useMemo(() => {
    const map = new Map<string, InstructorSummary>();
    const courseSets = new Map<string, Set<string>>();
    for (const c of comments) {
      if (platformFilter !== "all" && c._platform !== platformFilter) continue;
      const key = `${c._platform}|${c._instructor}`;
      if (!map.has(key)) {
        map.set(key, {
          instructor: c._instructor,
          platform: c._platform,
          courses: [],
          total: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          confirmed: 0,
          starred: 0,
          comments: [],
        });
        courseSets.set(key, new Set());
      }
      const s = map.get(key)!;
      if (c._course) courseSets.get(key)!.add(c._course);
      s.total++;
      if (c.sentiment === "positive") s.positive++;
      else if (c.sentiment === "negative") s.negative++;
      else s.neutral++;
      if (isDone(c)) s.confirmed++;
      if (starredIds.has(c.id)) s.starred++;
      s.comments.push(c);
    }
    for (const [key, courses] of courseSets) {
      map.get(key)!.courses = Array.from(courses).sort();
    }
    let result = Array.from(map.values());

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.instructor.toLowerCase().includes(q) || s.platform.toLowerCase().includes(q)
      );
    }

    // 플랫폼: 핏크닉 → 머니업클래스 → 기타, 같은 플랫폼 내 강사명 ㄱㄴㄷ순
    const platformOrder: Record<string, number> = { "핏크닉": 0, "머니업클래스": 1 };
    result.sort((a, b) => {
      const pa = platformOrder[a.platform] ?? 99;
      const pb = platformOrder[b.platform] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.instructor.localeCompare(b.instructor, "ko");
    });
    return result;
  }, [comments, platformFilter, search, confirmedIds, starredIds]);

  // 완료 강사 수 + 표시 목록
  const completedInstructorCount = useMemo(() =>
    instructorSummaries.filter(s => s.total > 0 && s.confirmed >= s.total).length,
    [instructorSummaries]
  );
  const visibleSummaries = useMemo(() =>
    showCompleted
      ? instructorSummaries
      : instructorSummaries.filter(s => s.total === 0 || s.confirmed < s.total),
    [instructorSummaries, showCompleted]
  );

  const totalCount = useMemo(
    () => instructorSummaries.reduce((sum, s) => sum + s.total, 0),
    [instructorSummaries]
  );

  // 선택된 강사의 상세 데이터
  const selectedSummary = useMemo(
    () => instructorSummaries.find((s) => `${s.platform}|${s.instructor}` === selectedInstructor) || null,
    [instructorSummaries, selectedInstructor]
  );

  // 상세 뷰 강의 목록
  const detailCourses = useMemo(() => {
    if (!selectedSummary) return [];
    return selectedSummary.courses;
  }, [selectedSummary]);

  // 상세 뷰 기수/문항 목록 (강의 필터 연동)
  const detailCohorts = useMemo(() => {
    if (!selectedSummary) return [];
    const filtered = courseFilter !== "all"
      ? selectedSummary.comments.filter((c) => c._course === courseFilter)
      : selectedSummary.comments;
    return Array.from(new Set(filtered.map((c) => c._cohort).filter(Boolean))).sort();
  }, [selectedSummary, courseFilter]);

  const detailSourceFields = useMemo(() => {
    if (!selectedSummary) return [];
    const set = new Set(selectedSummary.comments.map((c) => c.source_field));
    return FIELD_ORDER.filter((f) => set.has(f));
  }, [selectedSummary]);

  // 상세 뷰 필터링 (미확인/확인완료 탭 기준)
  const detailFiltered = useMemo(() => {
    if (!selectedSummary) return [];
    return selectedSummary.comments.filter((c) => {
      const isConfirmed = isDone(c);
      const isStarred = starredIds.has(c.id);
      if (viewMode === "unconfirmed" && isConfirmed) return false;
      if (viewMode === "confirmed" && (!isConfirmed || isStarred)) return false;
      if (viewMode === "starred" && !isStarred) return false;
      if (courseFilter !== "all" && c._course !== courseFilter) return false;
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
  }, [selectedSummary, courseFilter, cohortFilter, sourceFieldFilter, sentimentFilter, detailSearch, viewMode, confirmedIds, starredIds]);

  // 탭별 건수 (필터 무관하게 해당 강사 전체 기준)
  const starredCount = useMemo(() => {
    if (!selectedSummary) return 0;
    return selectedSummary.comments.filter((c) => starredIds.has(c.id)).length;
  }, [selectedSummary, starredIds]);
  const confirmedCount = useMemo(() => {
    if (!selectedSummary) return 0;
    return selectedSummary.comments.filter((c) => isDone(c) && !starredIds.has(c.id)).length;
  }, [selectedSummary, confirmedIds, starredIds]);
  const unconfirmedCount = useMemo(() => {
    if (!selectedSummary) return 0;
    return selectedSummary.total - confirmedCount - starredCount;
  }, [selectedSummary, confirmedCount, starredCount]);

  // showCompleted OFF → 선택된 강사가 완료 강사면 해제
  useEffect(() => {
    if (showCompleted || !selectedInstructor) return;
    const summary = instructorSummaries.find(s => `${s.platform}|${s.instructor}` === selectedInstructor);
    if (summary && summary.total > 0 && summary.confirmed >= summary.total) {
      setSelectedInstructor(null);
    }
  }, [showCompleted, selectedInstructor, instructorSummaries]);

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
    const instName = selectedSummary?.instructor || VIEW_ROLE_LABELS[role];
    a.download = `${instName}_${VIEW_ROLE_LABELS[role]}_피드백_${new Date().toISOString().slice(0, 10)}.csv`;
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
            {(["all", "pm", "pd", "cs", "platform", "etc", "instructor"] as ViewRole[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`py-1.5 px-4 rounded-md text-[13px] font-semibold transition-colors ${
                  role === r
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {VIEW_ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {completedInstructorCount > 0 && (
            <button
              onClick={() => setShowCompleted(prev => !prev)}
              className={`flex items-center gap-1 py-1 px-2.5 rounded-lg border text-[12px] font-semibold transition-colors ${
                showCompleted
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : "text-muted-foreground bg-muted border-border"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              완료 {completedInstructorCount}명 {showCompleted ? "숨기기" : "보기"}
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
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
            <div className="text-[14px] text-muted-foreground">{VIEW_ROLE_LABELS[role]} 피드백을 불러오는 중입니다...</div>
            <div className="text-[13px] text-muted-foreground/60 mt-1">잠시만 기다려주세요</div>
          </div>
        )}

        {/* 데이터 없음 */}
        {!loading && loaded && comments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-[30px] opacity-25 mb-2">💬</div>
            <div className="text-[14px] font-bold">{VIEW_ROLE_LABELS[role]} 피드백이 없습니다</div>
            <div className="text-[13px] mt-1">
              분류작업에서 {role === "all" ? "직무" : VIEW_ROLE_LABELS[role]} 태그를 지정하면 여기에 표시됩니다
            </div>
          </div>
        )}

        {/* 강사 요약 카드 그리드 */}
        {loaded && visibleSummaries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
            {visibleSummaries.map((s) => {
              const key = `${s.platform}|${s.instructor}`;
              const isActive = selectedInstructor === key;
              const pct = positivePercent(s);
              const photo = photoMap.get(key);
              const pColor = PLATFORM_COLORS[s.platform] || DEFAULT_PLATFORM_COLOR;
              const isCompleted = s.total > 0 && s.confirmed >= s.total;
              return (
                <button
                  key={key}
                  onClick={() => handleCardClick(key)}
                  className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-150 text-center ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                  } ${isCompleted ? "opacity-60" : ""}`}
                >
                  {/* 완료 뱃지 */}
                  {isCompleted && (
                    <span className="absolute top-1.5 left-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      ✓ 완료
                    </span>
                  )}
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
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${pColor.bg} ${pColor.text} ${pColor.border}`}>{s.platform}</span>
                  {s.courses.length > 1 && (
                    <span className="text-[11px] text-muted-foreground mt-1">{s.courses.length}개 강의</span>
                  )}
                  <div className="flex items-center gap-1.5 mt-2.5 w-full">
                    <span className="text-[20px] font-extrabold text-primary">{s.total}</span>
                    <span className="text-[12px] text-muted-foreground">건</span>
                    {(s.starred > 0 || s.confirmed > 0) && <div className="flex-1" />}
                    {s.starred > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-amber-500 font-semibold">
                        <Star className="w-3 h-3 fill-amber-400" />{s.starred}
                      </span>
                    )}
                    {s.confirmed > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-emerald-600 font-semibold">
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
        {loaded && comments.length > 0 && visibleSummaries.length === 0 && (
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
              {(() => { const pc = PLATFORM_COLORS[selectedSummary.platform] || DEFAULT_PLATFORM_COLOR; return (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${pc.bg} ${pc.text} ${pc.border}`}>{selectedSummary.platform}</span>
              ); })()}
              <span className="text-[13px] font-bold text-primary">{detailFiltered.length}건</span>
              <div className="flex-1" />
              {(role === "instructor" || role === "all") && (
                <button
                  onClick={() => {
                    setShareDialogTarget({ platform: selectedSummary.platform, instructor: selectedSummary.instructor });
                    setShareDialogOpen(true);
                  }}
                  className="flex items-center gap-1 py-1 px-2.5 rounded-lg border text-[12px] font-medium bg-card hover:bg-muted/80 text-foreground transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  공유 링크
                </button>
              )}
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
              {/* 미확인 / 확인완료 / 중요 탭 */}
              <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
                {([
                  { key: "unconfirmed" as const, label: "미확인", count: unconfirmedCount },
                  { key: "confirmed" as const, label: "확인완료", count: confirmedCount },
                  { key: "starred" as const, label: "중요", count: starredCount },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setViewMode(tab.key); setSelected(new Set()); }}
                    className={`py-1 px-3 rounded-md text-[13px] font-semibold transition-colors flex items-center gap-1 ${
                      viewMode === tab.key
                        ? tab.key === "starred"
                          ? "bg-card text-amber-600 shadow-sm"
                          : tab.key === "confirmed"
                            ? "bg-card text-emerald-600 shadow-sm"
                            : "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.key === "starred" && <Star className={`w-3 h-3 ${viewMode === "starred" ? "fill-amber-400" : ""}`} />}
                    {tab.label} {tab.count}
                  </button>
                ))}
              </div>

              {detailCourses.length > 1 && (
                <select
                  value={courseFilter}
                  onChange={(e) => { setCourseFilter(e.target.value); setCohortFilter("all"); }}
                  className="py-1.5 px-2.5 rounded-lg border text-[13px] bg-card"
                >
                  <option value="all">전체 강의</option>
                  {detailCourses.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              )}

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
            <div className="h-[calc(100vh-420px)] overflow-y-auto">
              {detailFiltered.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-[14px]">
                  {viewMode === "starred"
                    ? "중요 표시된 피드백이 없습니다"
                    : viewMode === "confirmed"
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
                            {role === "all" && comment.tag && TAG_TO_ROLE[comment.tag] && (
                              <span className="text-[11px] py-0.5 px-1.5 rounded font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                                {ROLE_LABELS[TAG_TO_ROLE[comment.tag]]}
                              </span>
                            )}
                            {transferOrigins[comment.id] && (() => {
                              const fromRole = TAG_TO_ROLE[transferOrigins[comment.id]];
                              return fromRole ? (
                                <span className="text-[11px] py-0.5 px-1.5 rounded font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                                  {ROLE_LABELS[fromRole]}에서 이관
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        {/* 이관 버튼 */}
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() => setTransferDropdownId(transferDropdownId === comment.id ? null : comment.id)}
                            title="다른 직무로 이관"
                            className="p-1 rounded transition-colors text-muted-foreground/40 hover:text-violet-600"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                          {transferDropdownId === comment.id && (
                            <div ref={transferDropdownRef} className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-lg shadow-lg py-1 min-w-[120px]">
                              {(Object.keys(ROLE_LABELS) as Role[])
                                .filter((r) => role === "all" ? r !== TAG_TO_ROLE[getEffectiveTag(comment)] : r !== role)
                                .map((r) => (
                                  <button
                                    key={r}
                                    onClick={() => transferComments([comment.id], r)}
                                    className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
                                  >
                                    {ROLE_LABELS[r]}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleStar(comment.id)}
                          title={starredIds.has(comment.id) ? "중요 해제" : "중요 표시"}
                          className={`shrink-0 p-1 rounded transition-colors ${
                            starredIds.has(comment.id)
                              ? "text-amber-500 hover:text-amber-600"
                              : "text-muted-foreground/40 hover:text-amber-500"
                          }`}
                        >
                          <Star className={`w-4 h-4 ${starredIds.has(comment.id) ? "fill-amber-400" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleConfirm(comment.id)}
                          title={isConfirmed ? "확인 해제" : "확인 완료"}
                          className={`shrink-0 p-1 rounded transition-colors ${
                            isConfirmed
                              ? "text-emerald-600 hover:text-emerald-800"
                              : "text-muted-foreground/40 hover:text-emerald-600"
                          }`}
                        >
                          <CheckCircle2 className="w-4.5 h-4.5" />
                        </button>
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
                {/* 다중 이관 */}
                <div className="relative">
                  <button
                    onClick={() => setTransferDropdownId(transferDropdownId === "__bulk__" ? null : "__bulk__")}
                    className="py-1 px-3 rounded-lg bg-violet-600 text-white text-[12px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    이관
                  </button>
                  {transferDropdownId === "__bulk__" && (
                    <div ref={transferDropdownRef} className="absolute bottom-full mb-1 right-0 z-50 bg-card border rounded-lg shadow-lg py-1 min-w-[120px]">
                      {ALL_ROLES.map((r) => (
                          <button
                            key={r}
                            onClick={() => transferComments(Array.from(selected), r)}
                            className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-muted transition-colors"
                          >
                            {ROLE_LABELS[r]}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
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

      {/* 공유 링크 다이얼로그 */}
      {shareDialogTarget && (
        <ShareLinkDialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          platform={shareDialogTarget.platform}
          instructor={shareDialogTarget.instructor}
          cohorts={detailCohorts}
        />
      )}
    </div>
  );
}
