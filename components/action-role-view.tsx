"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { CommentWithAction, ActionTag, ProcessStatus, ActionTheme } from "@/lib/types";
import {
  ACTION_TAGS,
  ACTION_TAG_ORDER,
  PROCESS_OPTIONS,
  getActionTagColor,
  getActionTagLabel,
  getProcessLabel,
  getProcessColor,
  isProcessed,
  isClassifiableComment,
  buildScopeKey,
  TAG_TO_AI_LABEL,
} from "@/lib/action-utils";
import { FIELD_LABELS, FIELD_ORDER, isUsefulComment } from "@/lib/feedback-utils";
import { useAppStore } from "@/hooks/use-app-store";
import {
  Loader2,
  Search,
  ChevronRight,
  ChevronDown,
  Undo2,
  Sparkles,
  Layers,
  Eye,
  EyeOff,
  User,
  CheckCircle2,
  Copy,
  Check,
  X,
  Download,
  Share2,
  BarChart3,
  Info,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ActionStatusView } from "./action-status-view";
import { ShareLinkDialog } from "./share-link-dialog";

// ===== 타입 & 상수 =====

type ViewTag = ActionTag | "all";
type ViewMode = "unprocessed" | "processed";
type SubView = "roles" | "dashboard" | "review";

const ACTION_ROLE_LABELS: Record<ActionTag, string> = {
  instructor: "강사",
  pm: "PM",
  pd: "PD",
  dev: "개발",
  cs: "CS",
  no_action: "기타",
};

const VIEW_TAG_LABELS: Record<ViewTag, string> = {
  all: "전체",
  ...ACTION_ROLE_LABELS,
};

const PLATFORM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  핏크닉: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  머니업클래스: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};
const DEFAULT_PLATFORM_COLOR = { bg: "bg-muted", text: "text-foreground", border: "border-border" };

const PROCESS_BAR_COLORS: Record<string, string> = {
  self_resolved: "bg-green-500",
  needs_discussion: "bg-blue-500",
  next_cohort: "bg-amber-500",
};
const PROCESS_CARD_BG: Record<string, string> = {
  self_resolved: "bg-green-50/40",
  needs_discussion: "bg-blue-50/40",
  next_cohort: "bg-amber-50/40",
};
const PROCESS_CHECK_COLORS: Record<string, string> = {
  self_resolved: "bg-green-500 border-green-500",
  needs_discussion: "bg-blue-500 border-blue-500",
  next_cohort: "bg-amber-500 border-amber-500",
};

interface InstructorSummary {
  instructor: string;
  platform: string;
  courses: string[];
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  processed: number;
  comments: CommentWithAction[];
}

// ===== 메인 컴포넌트 =====

export function ActionRoleView() {
  const { state } = useAppStore();
  const [activeTag, setActiveTag] = useState<ViewTag>("all");
  const [subView, setSubView] = useState<SubView>("roles");
  const [comments, setComments] = useState<CommentWithAction[]>([]);
  const [themes, setThemes] = useState<ActionTheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // 분류 기준 팝업
  const [showCriteriaPopup, setShowCriteriaPopup] = useState(false);

  // 필터
  const [platformFilter, setPlatformFilter] = useState("all");
  const [search, setSearch] = useState("");

  // 선택된 강사
  const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);

  // 리뷰 뷰
  const [reviewFilter, setReviewFilter] = useState<"all" | "needs_discussion" | "next_cohort">("all");
  const [reviewPlatformFilter, setReviewPlatformFilter] = useState("all");
  const [reviewSearch, setReviewSearch] = useState("");
  const [selectedReviewInstructor, setSelectedReviewInstructor] = useState<string | null>(null);
  const [reviewDetailFilter, setReviewDetailFilter] = useState<"all" | "needs_discussion" | "next_cohort">("all");
  const [reviewResolving, setReviewResolving] = useState<Set<string>>(new Set());
  const reviewResolveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // 완료 강사 숨김
  const [showCompleted, setShowCompleted] = useState(false);

  // 상세 뷰 필터
  const [viewMode, setViewMode] = useState<ViewMode>("unprocessed");
  const [courseFilter, setCourseFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [sourceFieldFilter, setSourceFieldFilter] = useState("all");
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const [processStatusFilter, setProcessStatusFilter] = useState<"all" | ProcessStatus>("all");
  const [detailSearch, setDetailSearch] = useState("");

  // 체크박스 + 복사
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // 이관
  const [transferDropdownId, setTransferDropdownId] = useState<string | null>(null);
  const [transferOrigins, setTransferOrigins] = useState<Record<string, string>>({});
  const transferDropdownRef = useRef<HTMLDivElement>(null);

  // 공유 링크
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDialogTarget, setShareDialogTarget] = useState<{ platform: string; instructor: string } | null>(null);

  // AI 진행
  const [classifying, setClassifying] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState("");
  const [themesLoading, setThemesLoading] = useState(false);

  // 처리 메모
  const [memoInputId, setMemoInputId] = useState<string | null>(null);
  const [memoText, setMemoText] = useState("");

  // 처리 버튼 피드백 (commentId:status → true)
  const [justProcessed, setJustProcessed] = useState<string | null>(null);

  // 테마 접기/펼치기
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [showProcessed, setShowProcessed] = useState(false);

  // 스크롤 ref
  const detailRef = useRef<HTMLDivElement>(null);

  // ===== 데이터 로딩 =====

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const tags = ["platform_pm", "platform_pd", "platform_cs", "platform_general", "platform_etc", "instructor"];
      const results = await Promise.all(
        tags.map((tag) =>
          fetch(`/api/classify?tag=${tag}`)
            .then((res) => (res.ok ? res.json() : []))
            .catch(() => [])
        )
      );
      const all: CommentWithAction[] = results.flat();
      const seen = new Set<string>();
      const unique = all.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      }).map((c) => ({
        ...c,
        // 마이그레이션: no_action_needed → self_resolved (기존 DB 데이터 호환)
        process_status: (c.process_status as string) === "no_action_needed" ? "self_resolved" as ProcessStatus : c.process_status,
      }));
      setComments(unique.filter(isClassifiableComment));
      setLoaded(true);
    } catch {
      toast.error("댓글 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTransferOrigins = useCallback(async () => {
    try {
      const res = await fetch("/api/app-settings");
      if (!res.ok) return;
      const d = await res.json();
      if (d.transferOrigins && typeof d.transferOrigins === "object") {
        setTransferOrigins(d.transferOrigins);
      }
    } catch { /* ignore */ }
  }, []);

  const loadThemes = useCallback(async (scopeKey: string) => {
    try {
      const res = await fetch(`/api/action-themes?scope_key=${encodeURIComponent(scopeKey)}`);
      if (res.ok) setThemes(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadComments();
    loadTransferOrigins();
  }, [loadComments, loadTransferOrigins]);

  // 역할 변경 시 초기화
  useEffect(() => {
    setSelected(new Set());
    setSelectedInstructor(null);
    resetDetailFilters();
  }, [activeTag]);

  // 서브뷰 변경 시 리뷰 초기화
  useEffect(() => {
    setSelectedReviewInstructor(null);
    setReviewFilter("all");
    setReviewDetailFilter("all");
    setReviewPlatformFilter("all");
    setReviewSearch("");
    // 보류 중인 해결 타이머 모두 취소
    for (const timer of reviewResolveTimers.current.values()) clearTimeout(timer);
    reviewResolveTimers.current.clear();
    setReviewResolving(new Set());
  }, [subView]);

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

  const resetDetailFilters = () => {
    setCourseFilter("all");
    setCohortFilter("all");
    setSourceFieldFilter("all");
    setSentimentFilter("all");
    setDetailSearch("");
    setSelected(new Set());
    setViewMode("unprocessed");
  };

  // ===== 파생 데이터 =====

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tag of ACTION_TAG_ORDER) counts[tag] = 0;
    counts["all"] = 0;
    counts["unclassified"] = 0;
    for (const c of comments) {
      if (c.action_tag) {
        if (!isProcessed(c)) {
          counts[c.action_tag] = (counts[c.action_tag] || 0) + 1;
          counts["all"]++;
        }
      } else {
        counts["unclassified"]++;
      }
    }
    return counts;
  }, [comments]);

  const activeComments = useMemo(() => {
    if (activeTag === "all") return comments.filter((c) => c.action_tag);
    return comments.filter((c) => c.action_tag === activeTag);
  }, [comments, activeTag]);

  const unclassifiedCount = tagCounts["unclassified"] || 0;

  const platformLabels = useMemo(() => {
    const set = new Set(activeComments.map((c) => c._platform).filter(Boolean));
    return Array.from(set).sort();
  }, [activeComments]);

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

  // 강사별 요약
  const instructorSummaries = useMemo(() => {
    const map = new Map<string, InstructorSummary>();
    const courseSets = new Map<string, Set<string>>();

    for (const c of activeComments) {
      if (platformFilter !== "all" && c._platform !== platformFilter) continue;
      const key = `${c._platform}|${c._instructor}`;
      if (!map.has(key)) {
        map.set(key, {
          instructor: c._instructor, platform: c._platform, courses: [],
          total: 0, positive: 0, negative: 0, neutral: 0, processed: 0, comments: [],
        });
        courseSets.set(key, new Set());
      }
      const s = map.get(key)!;
      if (c._course) courseSets.get(key)!.add(c._course);
      s.total++;
      if (c.sentiment === "positive") s.positive++;
      else if (c.sentiment === "negative") s.negative++;
      else s.neutral++;
      if (isProcessed(c)) s.processed++;
      s.comments.push(c);
    }

    for (const [key, courses] of courseSets) {
      map.get(key)!.courses = Array.from(courses).sort();
    }

    let result = Array.from(map.values());
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => s.instructor.toLowerCase().includes(q) || s.platform.toLowerCase().includes(q));
    }
    result.sort((a, b) => b.total - a.total);
    return result;
  }, [activeComments, platformFilter, search]);

  const completedInstructorCount = useMemo(() =>
    instructorSummaries.filter((s) => s.total > 0 && s.processed >= s.total).length,
    [instructorSummaries]
  );

  const visibleSummaries = useMemo(() =>
    showCompleted
      ? instructorSummaries
      : instructorSummaries.filter((s) => s.total === 0 || s.processed < s.total),
    [instructorSummaries, showCompleted]
  );

  const totalCount = useMemo(() => instructorSummaries.reduce((sum, s) => sum + s.total, 0), [instructorSummaries]);

  // ===== 리뷰 뷰 파생 데이터 =====

  const reviewTotalCount = useMemo(() =>
    comments.filter(c => c.action_tag && (c.process_status === "needs_discussion" || c.process_status === "next_cohort")).length,
    [comments]
  );

  const reviewFilteredComments = useMemo(() => {
    return comments.filter(c => c.action_tag && (c.process_status === "needs_discussion" || c.process_status === "next_cohort"));
  }, [comments]);

  const reviewNeedsDiscussionCount = useMemo(() =>
    reviewFilteredComments.filter(c => c.process_status === "needs_discussion").length,
    [reviewFilteredComments]
  );
  const reviewNextCohortCount = useMemo(() =>
    reviewFilteredComments.filter(c => c.process_status === "next_cohort").length,
    [reviewFilteredComments]
  );

  const reviewPlatformLabels = useMemo(() => {
    const set = new Set(reviewFilteredComments.map(c => c._platform).filter(Boolean));
    return Array.from(set).sort();
  }, [reviewFilteredComments]);

  const reviewInstructorSummaries = useMemo(() => {
    const map = new Map<string, {
      instructor: string;
      platform: string;
      total: number;
      needsDiscussion: number;
      nextCohort: number;
      tagBreakdown: Record<string, number>;
      comments: CommentWithAction[];
    }>();

    const filtered = reviewFilter === "all"
      ? reviewFilteredComments
      : reviewFilteredComments.filter(c => c.process_status === reviewFilter);

    for (const c of filtered) {
      const key = `${c._platform}|${c._instructor}`;
      if (!map.has(key)) {
        map.set(key, {
          instructor: c._instructor,
          platform: c._platform,
          total: 0,
          needsDiscussion: 0,
          nextCohort: 0,
          tagBreakdown: {},
          comments: [],
        });
      }
      const s = map.get(key)!;
      s.total++;
      if (c.process_status === "needs_discussion") s.needsDiscussion++;
      if (c.process_status === "next_cohort") s.nextCohort++;
      if (c.action_tag) {
        s.tagBreakdown[c.action_tag] = (s.tagBreakdown[c.action_tag] || 0) + 1;
      }
      s.comments.push(c);
    }

    let result = Array.from(map.values());
    if (reviewPlatformFilter !== "all") {
      result = result.filter(s => s.platform === reviewPlatformFilter);
    }
    if (reviewSearch) {
      const q = reviewSearch.toLowerCase();
      result = result.filter(s => s.instructor.toLowerCase().includes(q) || s.platform.toLowerCase().includes(q));
    }
    return result.sort((a, b) => b.total - a.total);
  }, [reviewFilteredComments, reviewPlatformFilter, reviewSearch, reviewFilter]);

  const selectedReviewSummary = useMemo(
    () => reviewInstructorSummaries.find(s => `${s.platform}|${s.instructor}` === selectedReviewInstructor) || null,
    [reviewInstructorSummaries, selectedReviewInstructor]
  );

  const selectedSummary = useMemo(
    () => instructorSummaries.find((s) => `${s.platform}|${s.instructor}` === selectedInstructor) || null,
    [instructorSummaries, selectedInstructor]
  );

  // 상세 뷰 필터 옵션
  const detailCourses = useMemo(() => selectedSummary?.courses || [], [selectedSummary]);
  const detailCohorts = useMemo(() => {
    if (!selectedSummary) return [];
    return Array.from(new Set(selectedSummary.comments.map((c) => c._cohort).filter(Boolean))).sort();
  }, [selectedSummary]);
  const detailSourceFields = useMemo(() => {
    if (!selectedSummary) return [];
    const set = new Set(selectedSummary.comments.map((c) => c.source_field));
    return FIELD_ORDER.filter((f) => set.has(f));
  }, [selectedSummary]);

  // 상세 뷰 필터링
  const detailFiltered = useMemo(() => {
    if (!selectedSummary) return [];
    return selectedSummary.comments.filter((c) => {
      const processed = isProcessed(c);
      if (viewMode === "unprocessed" && processed) return false;
      if (viewMode === "processed" && !processed) return false;
      if (viewMode === "processed" && processStatusFilter !== "all" && c.process_status !== processStatusFilter) return false;
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
        if (!c.original_text.toLowerCase().includes(q) && !c.respondent?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [selectedSummary, viewMode, courseFilter, cohortFilter, sourceFieldFilter, sentimentFilter, processStatusFilter, detailSearch]);

  // 탭별 건수
  const processedCount = useMemo(() =>
    selectedSummary?.comments.filter((c) => isProcessed(c)).length || 0,
    [selectedSummary]
  );
  const unprocessedCount = useMemo(() =>
    (selectedSummary?.total || 0) - processedCount,
    [selectedSummary, processedCount]
  );
  const processStatusCounts = useMemo(() => {
    if (!selectedSummary) return {} as Record<ProcessStatus, number>;
    const counts = {} as Record<ProcessStatus, number>;
    for (const opt of PROCESS_OPTIONS) counts[opt.value] = 0;
    for (const c of selectedSummary.comments) {
      if (isProcessed(c) && c.process_status) counts[c.process_status] = (counts[c.process_status] || 0) + 1;
    }
    return counts;
  }, [selectedSummary]);

  // scope key (강사 선택 시)
  const selectedScopeKey = useMemo(() => {
    if (!selectedSummary) return "";
    return buildScopeKey(selectedSummary.platform, selectedSummary.instructor, "", "");
  }, [selectedSummary]);

  // 테마 카드 데이터
  const themeCards = useMemo(() => {
    if (!selectedSummary || activeTag === "all") return [];
    const activeThemes = themes.filter((t) => t.action_tag === activeTag);
    if (activeThemes.length === 0) return [];
    const commentMap = new Map(selectedSummary.comments.map((c) => [c.id, c]));
    return activeThemes.map((theme) => {
      const tc = (theme.comment_ids || []).map((id) => commentMap.get(id)).filter(Boolean) as CommentWithAction[];
      return { theme, comments: tc, processedCount: tc.filter(isProcessed).length };
    });
  }, [selectedSummary, themes, activeTag]);

  // 강사 선택 시 테마 로드
  useEffect(() => {
    if (selectedScopeKey) loadThemes(selectedScopeKey);
  }, [selectedScopeKey, loadThemes]);

  // showCompleted OFF 시 완료 강사 해제
  useEffect(() => {
    if (!showCompleted && selectedInstructor) {
      const s = instructorSummaries.find((s) => `${s.platform}|${s.instructor}` === selectedInstructor);
      if (s && s.total > 0 && s.processed >= s.total) setSelectedInstructor(null);
    }
  }, [showCompleted, selectedInstructor, instructorSummaries]);

  // ===== 액션 핸들러 =====

  // 이관
  const transferComments = useCallback(async (commentIds: string[], toTag: ActionTag) => {
    const results = await Promise.allSettled(
      commentIds.map((id) =>
        fetch("/api/action-process", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId: id, action_tag: toTag }),
        })
      )
    );
    const succeeded = commentIds.filter((_, i) => results[i].status === "fulfilled");
    if (succeeded.length === 0) { toast.error("이관 실패"); return; }

    // 이관 출처 저장
    const entries = Object.fromEntries(
      succeeded.map((id) => {
        const c = comments.find((c) => c.id === id);
        return [id, c?.action_tag || "instructor"];
      })
    );
    fetch("/api/app-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "comment_transfers", action: "add", entries }),
    }).catch(() => {});

    // 로컬 상태 업데이트
    setComments((prev) => prev.map((c) =>
      succeeded.includes(c.id) ? { ...c, action_tag: toTag } : c
    ));
    setTransferOrigins((prev) => ({ ...prev, ...entries }));
    toast.success(`${succeeded.length}건을 ${ACTION_ROLE_LABELS[toTag]}(으)로 이관했습니다`);
    setSelected(new Set());
    setTransferDropdownId(null);
  }, [comments]);

  // 처리 상태 (낙관적 업데이트 + 체크 애니메이션 유지)
  const handleProcess = async (commentId: string, status: ProcessStatus) => {
    const option = PROCESS_OPTIONS.find((o) => o.value === status);
    if (option?.memoRequired) {
      setMemoInputId(commentId);
      setMemoText("");
      return;
    }
    // 체크 애니메이션 먼저, 700ms 후 상태 반영 (목록에서 자연스럽게 제거)
    const key = `${commentId}:${status}`;
    setJustProcessed(key);
    // 백그라운드 API 호출 (애니메이션과 병렬)
    const apiCall = fetch("/api/action-process", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, process_status: status }),
    });
    setTimeout(() => {
      setJustProcessed((prev) => prev === key ? null : prev);
      setComments((prev) => prev.map((c) =>
        c.id === commentId ? { ...c, process_status: status, processed_at: new Date().toISOString() } : c
      ));
    }, 400);
    try {
      const res = await apiCall;
      if (!res.ok) throw new Error();
    } catch {
      // 실패 시 롤백
      setComments((prev) => prev.map((c) =>
        c.id === commentId ? { ...c, process_status: null, processed_at: null } : c
      ));
      toast.error("처리 상태 업데이트 실패");
    }
  };

  const handleProcessWithMemo = async (commentId: string) => {
    if (!memoText.trim()) { toast.error("메모를 입력해주세요"); return; }
    const savedMemo = memoText;
    const key = `${commentId}:needs_discussion`;
    setJustProcessed(key);
    setMemoInputId(null); setMemoText("");
    // 백그라운드 API 호출 (애니메이션과 병렬)
    const apiCall = fetch("/api/action-process", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, process_status: "needs_discussion" as ProcessStatus, process_memo: savedMemo }),
    });
    setTimeout(() => {
      setJustProcessed((prev) => prev === key ? null : prev);
      setComments((prev) => prev.map((c) =>
        c.id === commentId ? { ...c, process_status: "needs_discussion" as ProcessStatus, process_memo: savedMemo, processed_at: new Date().toISOString() } : c
      ));
    }, 400);
    try {
      const res = await apiCall;
      if (!res.ok) throw new Error();
    } catch {
      setComments((prev) => prev.map((c) =>
        c.id === commentId ? { ...c, process_status: null, process_memo: "", processed_at: null } : c
      ));
      toast.error("처리 상태 업데이트 실패");
    }
  };

  const handleUndoProcess = async (commentId: string) => {
    // 기존 상태 백업 (롤백용)
    const prev = comments.find((c) => c.id === commentId);
    const backup = prev ? { process_status: prev.process_status, process_memo: (prev as any).process_memo, processed_at: prev.processed_at } : null;
    // 즉시 로컬 상태 반영
    setComments((prev) => prev.map((c) =>
      c.id === commentId ? { ...c, process_status: null, process_memo: "", processed_at: null } : c
    ));
    try {
      const res = await fetch("/api/action-process", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // 실패 시 롤백
      if (backup) {
        setComments((prev) => prev.map((c) =>
          c.id === commentId ? { ...c, ...backup } : c
        ));
      }
      toast.error("처리 취소 실패");
    }
  };

  // 리뷰 해결 (유예 후 자체해결로 전환 — 낙관적 업데이트)
  const handleReviewResolve = (commentId: string) => {
    const originalStatus = comments.find(c => c.id === commentId)?.process_status ?? "needs_discussion";
    setReviewResolving((prev) => new Set(prev).add(commentId));
    const timer = setTimeout(() => {
      reviewResolveTimers.current.delete(commentId);
      // 즉시 로컬 상태 반영 (목록에서 제거)
      setComments((prev) => prev.map((c) =>
        c.id === commentId ? { ...c, process_status: "self_resolved" as ProcessStatus, processed_at: new Date().toISOString() } : c
      ));
      setReviewResolving((prev) => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
      // 백그라운드 API 호출
      fetch("/api/action-process", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId, process_status: "self_resolved" as ProcessStatus }),
      }).then((res) => {
        if (!res.ok) throw new Error();
      }).catch(() => {
        // 실패 시 원래 상태로 롤백
        setComments((prev) => prev.map((c) =>
          c.id === commentId ? { ...c, process_status: originalStatus as ProcessStatus, processed_at: null } : c
        ));
        toast.error("해결 처리 실패");
      });
    }, 1000);
    reviewResolveTimers.current.set(commentId, timer);
  };

  const handleReviewUndoResolve = (commentId: string) => {
    const timer = reviewResolveTimers.current.get(commentId);
    if (timer) {
      clearTimeout(timer);
      reviewResolveTimers.current.delete(commentId);
    }
    setReviewResolving((prev) => {
      const next = new Set(prev);
      next.delete(commentId);
      return next;
    });
  };

  // 복사
  const copySelected = () => {
    const items = detailFiltered.filter((c) => selected.has(c.id));
    const text = items.map((c) =>
      `"${c.original_text}" — ${c.respondent || ""}${c._cohort ? `, ${c._cohort}` : ""}`
    ).join("\n\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    toast.success(`${items.length}건 복사됨`);
    setTimeout(() => setCopied(false), 2000);
  };

  // 엑셀 내보내기
  const exportToExcel = () => {
    const data = detailFiltered;
    if (data.length === 0) { toast.info("내보낼 데이터가 없습니다"); return; }
    const headers = ["플랫폼", "강사", "기수", "감정", "액션태그", "처리상태", "설문 문항", "응답자", "원문"];
    const escape = (s: string) => {
      const t = String(s ?? "").replace(/"/g, '""');
      return t.includes(",") || t.includes('"') || t.includes("\n") ? `"${t}"` : t;
    };
    const sentimentLabel = (s: string | null) =>
      s === "positive" ? "긍정" : s === "negative" ? "부정" : s === "neutral" ? "미구분" : "";

    const rows = data.map((c) => [
      c._platform, c._instructor, c._cohort,
      sentimentLabel(c.sentiment), getActionTagLabel(c.action_tag), getProcessLabel(c.process_status),
      FIELD_LABELS[c.source_field] ?? c.source_field, c.respondent ?? "", c.original_text ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedSummary?.instructor || VIEW_TAG_LABELS[activeTag]}_${VIEW_TAG_LABELS[activeTag]}_피드백_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length}건 엑셀(CSV)로 내보냈습니다`);
  };

  // 전체 선택 토글
  const toggleSelectAll = () => {
    if (selected.size === detailFiltered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(detailFiltered.map((c) => c.id)));
    }
  };

  // AI 일괄 분류
  const handleClassifyAll = async () => {
    const targets = comments.filter((c) => !c.action_tag);
    if (targets.length === 0) { toast.info("미분류 댓글이 없습니다"); return; }
    setClassifying(true);
    setClassifyProgress(`0/${targets.length}`);
    try {
      const CHUNK = 200;
      let totalClassified = 0;
      for (let i = 0; i < targets.length; i += CHUNK) {
        const chunk = targets.slice(i, i + CHUNK);
        setClassifyProgress(`${Math.min(i + CHUNK, targets.length)}/${targets.length}`);
        const res = await fetch("/api/action-classify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: chunk.map((c) => ({ id: c.id, original_text: c.original_text, source_field: c.source_field })) }),
        });
        if (res.ok) {
          const { classified, results } = await res.json();
          totalClassified += classified;
          setComments((prev) => {
            const m = new Map(results.map((r: { id: string; action_tag: ActionTag }) => [r.id, r.action_tag]));
            return prev.map((c) => { const t = m.get(c.id); return t ? { ...c, action_tag: t } : c; });
          });
        }
      }
      toast.success(`${totalClassified}건 분류 완료`);
    } catch { toast.error("AI 분류 중 오류 발생"); }
    finally { setClassifying(false); setClassifyProgress(""); }
  };

  // AI 테마 분석
  const handleGenerateThemes = async () => {
    if (!selectedSummary || activeTag === "all" || activeTag === "no_action") return;
    const tagComments = selectedSummary.comments;
    if (tagComments.length === 0) { toast.info("댓글이 없습니다"); return; }
    setThemesLoading(true);
    try {
      const res = await fetch("/api/action-themes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope_key: selectedScopeKey, action_tag: activeTag,
          comments: tagComments.map((c) => ({ id: c.id, original_text: c.original_text })),
        }),
      });
      if (res.ok) {
        const { themes: count } = await res.json();
        toast.success(`${count}개 테마 생성`);
        await loadThemes(selectedScopeKey);
      } else toast.error("테마 분석 실패");
    } catch { toast.error("테마 분석 중 오류"); }
    finally { setThemesLoading(false); }
  };

  const toggleTheme = (themeId: string) => {
    setExpandedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) next.delete(themeId); else next.add(themeId);
      return next;
    });
  };

  // ===== 렌더링 =====

  if (loading && !loaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          <div className="text-[14px] text-muted-foreground">피드백을 불러오는 중입니다...</div>
        </div>
      </div>
    );
  }

  if (subView === "review") {
    const reviewDetailRef = detailRef;
    return (
      <div className="flex-1 overflow-y-auto p-6 px-8 min-w-0">
        <div className="w-full max-w-[1200px] mx-auto">
          {/* 헤더 */}
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-[18px] font-extrabold">직무별 피드백</h1>
            <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
              <button onClick={() => setSubView("roles")} className="py-1.5 px-4 rounded-md text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                직무별
              </button>
              <button className="py-1.5 px-4 rounded-md text-[13px] font-semibold bg-card text-primary shadow-sm transition-colors flex items-center gap-1.5">
                논의 필요
                {reviewTotalCount > 0 && (
                  <span className="text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{reviewTotalCount}</span>
                )}
              </button>
              <button onClick={() => setSubView("dashboard")} className="py-1.5 px-4 rounded-md text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                점검 현황
              </button>
            </div>
          </div>

          {/* 건수 + 필터 */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
              <button
                onClick={() => { setReviewFilter("all"); setSelectedReviewInstructor(null); }}
                className={`py-1 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${reviewFilter === "all" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                전체 {reviewTotalCount}
              </button>
              <button
                onClick={() => { setReviewFilter("needs_discussion"); setSelectedReviewInstructor(null); }}
                className={`py-1 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${reviewFilter === "needs_discussion" ? "bg-card text-blue-600 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                협의 필요 {reviewNeedsDiscussionCount}
              </button>
              <button
                onClick={() => { setReviewFilter("next_cohort"); setSelectedReviewInstructor(null); }}
                className={`py-1 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${reviewFilter === "next_cohort" ? "bg-card text-amber-600 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                다음 기수 {reviewNextCohortCount}
              </button>
            </div>
          </div>

          {/* 플랫폼 필터 + 강사 검색 */}
          <div className="flex items-center gap-2 mb-4">
            {reviewPlatformLabels.length > 1 && (
              <select
                value={reviewPlatformFilter}
                onChange={(e) => { setReviewPlatformFilter(e.target.value); setSelectedReviewInstructor(null); }}
                className="py-1.5 px-2.5 rounded-lg border text-[14px] bg-card"
              >
                <option value="all">전체 플랫폼</option>
                {reviewPlatformLabels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            <div className="relative flex-1 min-w-[140px] max-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                placeholder="강사 검색..."
                className="w-full py-1.5 pl-8 pr-3 rounded-lg border text-[14px] bg-card"
              />
            </div>
          </div>

          {/* 빈 상태 */}
          {reviewInstructorSummaries.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-[30px] opacity-25 mb-2">
                <MessageCircle className="w-8 h-8 mx-auto" />
              </div>
              <div className="text-[14px] font-bold">
                {reviewFilter === "next_cohort" ? "다음 기수 피드백이 없습니다" : reviewFilter === "needs_discussion" ? "협의 필요 피드백이 없습니다" : "논의 필요 피드백이 없습니다"}
              </div>
              <div className="text-[13px] mt-1">직무별 뷰에서 처리 상태를 지정하세요</div>
            </div>
          )}

          {/* 강사 카드 그리드 */}
          {reviewInstructorSummaries.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
              {reviewInstructorSummaries.map((s) => {
                const key = `${s.platform}|${s.instructor}`;
                const photo = photoMap.get(key);
                const pColor = PLATFORM_COLORS[s.platform] || DEFAULT_PLATFORM_COLOR;
                const isActive = selectedReviewInstructor === key;

                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (isActive) { setSelectedReviewInstructor(null); }
                      else {
                        setSelectedReviewInstructor(key);
                        setReviewDetailFilter("all");
                        setTimeout(() => reviewDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                      }
                    }}
                    className={`relative flex flex-col items-center justify-between p-4 rounded-xl border-2 transition-all duration-150 text-center min-h-[180px] ${
                      isActive ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                    }`}
                  >
                    {/* 프로필 */}
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-border/40 mb-2">
                        {photo?.photo ? (
                          <img src={photo.photo} alt="" className="w-full h-full object-cover" style={{ objectPosition: photo.photoPosition || "center 2%" }} />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-[15px] font-bold truncate w-full">{s.instructor}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${pColor.bg} ${pColor.text} ${pColor.border}`}>
                        {s.platform}
                      </span>
                    </div>

                    {/* 건수 */}
                    <div className="w-full mt-auto pt-3 space-y-1.5">
                      {s.needsDiscussion > 0 && (
                        <div className="flex items-center gap-1.5 justify-center">
                          <MessageCircle className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-[12px] font-semibold text-blue-600">협의 {s.needsDiscussion}건</span>
                        </div>
                      )}
                      {s.nextCohort > 0 && (
                        <div className="flex items-center gap-1.5 justify-center">
                          <ChevronRight className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[12px] font-semibold text-amber-600">다음 기수 {s.nextCohort}건</span>
                        </div>
                      )}

                      {/* 역할 분포 */}
                      {Object.keys(s.tagBreakdown).length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mt-1">
                          {Object.entries(s.tagBreakdown).sort((a, b) => b[1] - a[1]).map(([tag, count]) => (
                            <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getActionTagColor(tag as ActionTag)}`}>
                              {ACTION_ROLE_LABELS[tag as ActionTag]} {count}
                            </span>
                          ))}
                        </div>
                      )}
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

          {/* 상세 패널 */}
          {selectedReviewSummary && (
            <div ref={reviewDetailRef} className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden">
              {/* 헤더 */}
              <div className="flex items-center gap-3 py-3 px-5 bg-primary/5 border-b">
                <span className="text-[16px] font-extrabold">{selectedReviewSummary.instructor}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${(PLATFORM_COLORS[selectedReviewSummary.platform] || DEFAULT_PLATFORM_COLOR).bg} ${(PLATFORM_COLORS[selectedReviewSummary.platform] || DEFAULT_PLATFORM_COLOR).text} ${(PLATFORM_COLORS[selectedReviewSummary.platform] || DEFAULT_PLATFORM_COLOR).border}`}>
                  {selectedReviewSummary.platform}
                </span>
                <span className="text-[13px] font-bold text-primary">{selectedReviewSummary.total}건</span>
                {selectedReviewSummary.needsDiscussion > 0 && (
                  <span className="text-[12px] text-blue-600 flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" />협의 {selectedReviewSummary.needsDiscussion}
                  </span>
                )}
                {selectedReviewSummary.nextCohort > 0 && (
                  <span className="text-[12px] text-amber-600 flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5" />다음 기수 {selectedReviewSummary.nextCohort}
                  </span>
                )}
                <div className="flex-1" />
                <button onClick={() => setSelectedReviewInstructor(null)} className="p-1 rounded-lg hover:bg-accent transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* 상세 필터 탭 */}
              {selectedReviewSummary.total > 0 && (
                <div className="flex items-center gap-2 px-5 py-2.5 border-b bg-muted/20">
                  <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
                    <button
                      onClick={() => setReviewDetailFilter("all")}
                      className={`py-1 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${reviewDetailFilter === "all" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      전체 {selectedReviewSummary.total}
                    </button>
                    <button
                      onClick={() => setReviewDetailFilter("needs_discussion")}
                      className={`py-1 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${reviewDetailFilter === "needs_discussion" ? "bg-card text-blue-600 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      협의 필요 {selectedReviewSummary.needsDiscussion}
                    </button>
                    <button
                      onClick={() => setReviewDetailFilter("next_cohort")}
                      className={`py-1 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${reviewDetailFilter === "next_cohort" ? "bg-card text-amber-600 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      다음 기수 {selectedReviewSummary.nextCohort}
                    </button>
                  </div>
                </div>
              )}

              {/* 댓글 목록 */}
              <div className="max-h-[calc(100vh-420px)] overflow-y-auto divide-y">
                {selectedReviewSummary.comments.filter(c => reviewDetailFilter === "all" || c.process_status === reviewDetailFilter).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-[14px]">해당 필터에 맞는 피드백이 없습니다</div>
                ) : (
                  selectedReviewSummary.comments.filter(c => reviewDetailFilter === "all" || c.process_status === reviewDetailFilter).map((comment) => {
                    const isNeedsDiscussion = comment.process_status === "needs_discussion";
                    const isNextCohort = comment.process_status === "next_cohort";
                    const isResolving = reviewResolving.has(comment.id);

                    return (
                      <div key={comment.id} className={`py-3 px-5 transition-all duration-300 ${isResolving ? "opacity-40 bg-green-50/50" : isNeedsDiscussion ? "bg-blue-50/30" : isNextCohort ? "bg-amber-50/30" : ""}`}>
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            <p className={`text-[14px] leading-relaxed ${isResolving ? "line-through" : ""}`}>{comment.original_text}</p>
                            {!isResolving && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[12px] text-muted-foreground">
                                {/* 역할 뱃지 */}
                                {comment.action_tag && (
                                  <span className={`text-[11px] py-0.5 px-1.5 rounded font-semibold border ${getActionTagColor(comment.action_tag)}`}>
                                    {getActionTagLabel(comment.action_tag)}
                                  </span>
                                )}
                                {/* 감정 */}
                                {comment.sentiment && (
                                  <span className={`text-[11px] py-0.5 px-1.5 rounded font-semibold ${
                                    comment.sentiment === "positive" ? "bg-emerald-100 text-emerald-700"
                                    : comment.sentiment === "negative" ? "bg-rose-100 text-rose-700"
                                    : "bg-muted text-foreground"
                                  }`}>
                                    {comment.sentiment === "positive" ? "긍정" : comment.sentiment === "negative" ? "부정" : "미구분"}
                                  </span>
                                )}
                                {/* 응답자 */}
                                <span className="font-semibold text-foreground/60">{comment.respondent}</span>
                                {/* 강의/기수 */}
                                {comment._course && <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{comment._course}</span>}
                                {comment._cohort && <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{comment._cohort}</span>}
                                {/* 문항 */}
                                <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{FIELD_LABELS[comment.source_field] || comment.source_field}</span>
                                {/* 처리 상태 */}
                                {(isNeedsDiscussion || isNextCohort) && (
                                  <span className={`text-[11px] py-0.5 px-1.5 rounded font-semibold border ${getProcessColor(comment.process_status)}`}>
                                    {getProcessLabel(comment.process_status)}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* 메모 강조 */}
                            {!isResolving && isNeedsDiscussion && comment.process_memo && (
                              <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-[13px] text-blue-700">
                                <MessageCircle className="w-3.5 h-3.5 inline mr-1.5" />
                                {comment.process_memo}
                              </div>
                            )}
                          </div>

                          {/* 오른쪽: 해결 버튼 or 되돌리기 + 중요 표시 */}
                          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                            {isResolving ? (
                              <button
                                onClick={() => handleReviewUndoResolve(comment.id)}
                                className="text-[12px] px-3 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors flex items-center gap-1 font-semibold"
                              >
                                <Undo2 className="w-3.5 h-3.5" />되돌리기
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReviewResolve(comment.id)}
                                className="text-[12px] px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1 font-semibold"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />해결
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (subView === "dashboard") {
    return (
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="w-full max-w-[1200px] mx-auto px-8 py-4">
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-[18px] font-extrabold">직무별 피드백</h1>
            <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
              <button onClick={() => setSubView("roles")} className="py-1.5 px-4 rounded-md text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                직무별
              </button>
              <button onClick={() => setSubView("review")} className="py-1.5 px-4 rounded-md text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
                논의 필요
                {reviewTotalCount > 0 && (
                  <span className="text-[11px] bg-muted-foreground/10 px-1.5 py-0.5 rounded-full font-bold">{reviewTotalCount}</span>
                )}
              </button>
              <button className="py-1.5 px-4 rounded-md text-[13px] font-semibold bg-card text-primary shadow-sm transition-colors">
                점검 현황
              </button>
            </div>
          </div>
        </div>
        <ActionStatusView comments={comments} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 px-8 min-w-0">
      <div className="w-full max-w-[1200px] mx-auto">
        {/* 헤더: 제목 + 서브탭 + AI 분류 버튼 */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <h1 className="text-[18px] font-extrabold">직무별 피드백</h1>

          {/* 분류 기준 안내 */}
          <div className="relative">
            <button
              onClick={() => setShowCriteriaPopup((v) => !v)}
              className="w-6 h-6 rounded-full border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              title="분류 기준 보기"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {showCriteriaPopup && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCriteriaPopup(false)} />
                <div className="absolute left-0 top-full mt-2 z-50 w-[480px] bg-card border rounded-xl shadow-xl p-5 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[15px] font-bold">액션 기반 분류 기준</span>
                    <button onClick={() => setShowCriteriaPopup(false)} className="p-1 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="text-[12px] text-muted-foreground mb-3">&quot;누가 액션을 취해야 하는가?&quot; 기준으로 댓글을 6개 카테고리로 분류합니다.</p>
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1.5 pr-3 font-semibold">분류</th>
                        <th className="text-left py-1.5 font-semibold">기준</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b"><td className="py-2 pr-3"><span className="px-1.5 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-200 text-[12px] font-semibold">강사</span></td><td className="py-2 text-muted-foreground">강사가 바꾸면 해결 — 수업 방식, 진도, 자료, 설명, 소통, 칭찬</td></tr>
                      <tr className="border-b"><td className="py-2 pr-3"><span className="px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 text-[12px] font-semibold">PM</span></td><td className="py-2 text-muted-foreground">기획·운영 — 커리큘럼 구조, 시수, 일정, 장소, 수강 프로세스, 공지</td></tr>
                      <tr className="border-b"><td className="py-2 pr-3"><span className="px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 text-[12px] font-semibold">PD</span></td><td className="py-2 text-muted-foreground">영상 편집 — 화질, 편집, 화면 비율, 포커스, 영상 길이, 음질</td></tr>
                      <tr className="border-b"><td className="py-2 pr-3"><span className="px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 text-[12px] font-semibold">개발</span></td><td className="py-2 text-muted-foreground">시스템 수정 — 접속 오류, 로딩, 버그, 플랫폼 시스템, AI 툴</td></tr>
                      <tr className="border-b"><td className="py-2 pr-3"><span className="px-1.5 py-0.5 rounded border bg-cyan-50 text-cyan-700 border-cyan-200 text-[12px] font-semibold">CS</span></td><td className="py-2 text-muted-foreground">돈·계약 — 환불, 결제 오류, 수강권, 가격 불만, 과장 광고</td></tr>
                      <tr><td className="py-2 pr-3"><span className="px-1.5 py-0.5 rounded border bg-gray-50 text-gray-500 border-gray-200 text-[12px] font-semibold">기타</span></td><td className="py-2 text-muted-foreground">처리 불필요 — 단순 감상, 의미없는 답변, 개인 사정, 막연한 기대</td></tr>
                    </tbody>
                  </table>
                  <div className="mt-3 pt-3 border-t text-[11px] text-muted-foreground space-y-1">
                    <p>• 강사 관련 긍정 피드백(칭찬)도 <strong>강사</strong>로 분류</p>
                    <p>• 하나의 댓글에 여러 주제 → 가장 핵심적인 것 기준</p>
                    <p>• 구체적 요청 없이 막연한 기대는 <strong>기타</strong></p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 서브탭 (직무별 / 논의 필요 / 점검 현황) */}
          <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
            <button className="py-1.5 px-4 rounded-md text-[13px] font-semibold bg-card text-primary shadow-sm transition-colors">
              직무별
            </button>
            <button onClick={() => setSubView("review")} className="py-1.5 px-4 rounded-md text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
              논의 필요
              {reviewTotalCount > 0 && (
                <span className="text-[11px] bg-muted-foreground/10 px-1.5 py-0.5 rounded-full font-bold">{reviewTotalCount}</span>
              )}
            </button>
            <button onClick={() => setSubView("dashboard")} className="py-1.5 px-4 rounded-md text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
              점검 현황
            </button>
          </div>

          <div className="flex-1" />

          {/* AI 일괄 분류 */}
          {unclassifiedCount > 0 && (
            <button
              onClick={handleClassifyAll}
              disabled={classifying}
              className="text-[12px] px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {classifying ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />분류 중 {classifyProgress}</> : <><Sparkles className="w-3.5 h-3.5" />AI 일괄 분류 ({unclassifiedCount}건)</>}
            </button>
          )}

          <span className="text-[13px] text-muted-foreground font-semibold">총 {totalCount}건</span>
        </div>

        {/* 역할 탭 바 */}
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border mb-4">
          {(["all", ...ACTION_TAG_ORDER] as ViewTag[]).map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`py-1.5 px-4 rounded-md text-[13px] font-semibold transition-colors ${
                activeTag === tag ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {VIEW_TAG_LABELS[tag]}
              {tag !== "all" && <span className="ml-1 text-[11px] opacity-60">{tagCounts[tag] || 0}</span>}
              {tag === "all" && <span className="ml-1 text-[11px] opacity-60">{tagCounts["all"] || 0}</span>}
            </button>
          ))}
        </div>

        {/* 필터 바 */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {platformLabels.length > 1 && (
            <select
              value={platformFilter}
              onChange={(e) => { setPlatformFilter(e.target.value); setSelectedInstructor(null); }}
              className="text-[13px] border rounded-lg px-3 py-1.5 bg-background"
            >
              <option value="all">전체 플랫폼</option>
              {platformLabels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          <div className="relative flex-1 min-w-[140px] max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="강사 검색..." className="w-full pl-9 pr-3 py-1.5 text-[13px] border rounded-lg bg-background"
            />
          </div>
          <div className="flex-1" />

          {/* 완료 강사 토글 */}
          {completedInstructorCount > 0 && (
            <button
              onClick={() => setShowCompleted((prev) => !prev)}
              className={`flex items-center gap-1 py-1 px-2.5 rounded-lg border text-[12px] font-semibold transition-colors ${
                showCompleted ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-muted-foreground bg-muted border-border"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              완료 {completedInstructorCount}명 {showCompleted ? "숨기기" : "보기"}
            </button>
          )}
        </div>

        {/* 빈 상태 */}
        {!loading && loaded && activeComments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="text-[30px] opacity-25 mb-2">💬</div>
            <div className="text-[14px] font-bold">{VIEW_TAG_LABELS[activeTag]} 피드백이 없습니다</div>
            {unclassifiedCount > 0 && (
              <div className="text-[13px] mt-1">상단의 &quot;AI 일괄 분류&quot; 버튼을 눌러 분류를 시작하세요</div>
            )}
          </div>
        )}

        {/* 강사별 카드 그리드 */}
        {visibleSummaries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-5">
            {visibleSummaries.map((s) => {
              const key = `${s.platform}|${s.instructor}`;
              const photo = photoMap.get(key);
              const pColor = PLATFORM_COLORS[s.platform] || DEFAULT_PLATFORM_COLOR;
              const isActive = selectedInstructor === key;
              const isCompleted = s.total > 0 && s.processed >= s.total;
              const pct = s.total > 0 ? Math.round((s.positive / s.total) * 100) : 0;
              const negPct = s.total > 0 ? Math.round((s.negative / s.total) * 100) : 0;
              const procPct = s.total > 0 ? Math.round((s.processed / s.total) * 100) : 0;

              return (
                <button
                  key={key}
                  onClick={() => {
                    if (isActive) { setSelectedInstructor(null); }
                    else {
                      setSelectedInstructor(key);
                      resetDetailFilters();
                      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                    }
                  }}
                  className={`relative flex flex-col items-center justify-between p-4 rounded-xl border-2 transition-all duration-150 text-center min-h-[220px] ${
                    isActive ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                  } ${isCompleted ? "opacity-60" : ""}`}
                >
                  {isCompleted && (
                    <span className="absolute top-1.5 left-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded">✓ 완료</span>
                  )}

                  {/* 상단: 프로필 + 이름 + 플랫폼 */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-border/40 mb-2">
                      {photo?.photo ? (
                        <img src={photo.photo} alt="" className="w-full h-full object-cover" style={{ objectPosition: photo.photoPosition || "center 2%" }} />
                      ) : (
                        <User className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>

                    <span className="text-[15px] font-bold truncate w-full">{s.instructor}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${pColor.bg} ${pColor.text} ${pColor.border}`}>
                      {s.platform}
                    </span>
                    {s.courses.length > 1 && <span className="text-[11px] text-muted-foreground mt-1">{s.courses.length}개 강의</span>}
                  </div>

                  {/* 하단: 건수 + 감정바 + 처리율 (항상 하단 고정) */}
                  <div className="w-full mt-auto pt-2">
                  {/* 건수 + 아이콘 */}
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-[20px] font-extrabold text-primary">{s.total}</span>
                    <span className="text-[12px] text-muted-foreground">건</span>
                    {s.processed > 0 && <div className="flex-1" />}
                    {s.processed > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px] text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />{s.processed}
                      </span>
                    )}
                  </div>

                  {/* 감정 바 */}
                  <div className="w-full mt-2">
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                      {s.positive > 0 && <div className="bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />}
                      {s.negative > 0 && <div className="bg-rose-400 transition-all" style={{ width: `${negPct}%` }} />}
                    </div>
                    <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
                      <span>긍정 <span className="font-semibold text-emerald-600">{pct}%</span></span>
                      {s.negative > 0 && <span>부정 <span className="font-semibold text-rose-500">{negPct}%</span></span>}
                    </div>
                  </div>

                  {/* 처리 진행률 */}
                  <div className="w-full mt-1.5">
                    <div className="flex h-1 rounded-full overflow-hidden bg-muted">
                      <div className="bg-blue-400 transition-all" style={{ width: `${procPct}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">처리 {procPct}%</div>
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

        {loaded && activeComments.length > 0 && visibleSummaries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-[14px]">해당 조건의 강사가 없습니다</div>
        )}

        {/* ===== 상세 패널 ===== */}
        {selectedSummary && (
          <div ref={detailRef} className="rounded-xl border-2 border-primary/30 bg-card overflow-hidden">
            {/* 상세 헤더 */}
            <div className="flex items-center gap-3 py-3 px-5 bg-primary/5 border-b">
              <span className="text-[16px] font-extrabold">{selectedSummary.instructor}</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${(PLATFORM_COLORS[selectedSummary.platform] || DEFAULT_PLATFORM_COLOR).bg} ${(PLATFORM_COLORS[selectedSummary.platform] || DEFAULT_PLATFORM_COLOR).text} ${(PLATFORM_COLORS[selectedSummary.platform] || DEFAULT_PLATFORM_COLOR).border}`}>
                {selectedSummary.platform}
              </span>
              {activeTag !== "all" && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${getActionTagColor(activeTag)}`}>
                  {getActionTagLabel(activeTag)}
                </span>
              )}
              <span className="text-[13px] font-bold text-primary">{detailFiltered.length}건</span>
              <div className="flex-1" />

              {/* AI 테마 분석 버튼 */}
              {activeTag !== "all" && activeTag !== "no_action" && (
                <button
                  onClick={handleGenerateThemes}
                  disabled={themesLoading}
                  className="text-[12px] px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {themesLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />분석 중...</> : <><Layers className="w-3.5 h-3.5" />AI 테마 분석</>}
                </button>
              )}

              {/* 공유 링크 */}
              {(activeTag === "instructor" || activeTag === "all") && (
                <button
                  onClick={() => {
                    setShareDialogTarget({ platform: selectedSummary.platform, instructor: selectedSummary.instructor });
                    setShareDialogOpen(true);
                  }}
                  className="text-[12px] px-3 py-1.5 rounded-lg border hover:bg-accent transition-colors flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />공유 링크
                </button>
              )}

              {/* 닫기 */}
              <button onClick={() => setSelectedInstructor(null)} className="p-1 rounded-lg hover:bg-accent transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* 뷰모드 탭 + 필터 */}
            <div className="flex gap-2 items-center flex-wrap px-5 py-3 border-b bg-muted/20">
              {/* 뷰모드 탭 */}
              <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
                {([
                  { key: "unprocessed" as const, label: "미처리", count: unprocessedCount },
                  { key: "processed" as const, label: "처리완료", count: processedCount },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => { setViewMode(tab.key); setSelected(new Set()); setProcessStatusFilter("all"); }}
                    className={`py-1 px-3 rounded-md text-[13px] font-semibold transition-colors flex items-center gap-1 ${
                      viewMode === tab.key
                        ? tab.key === "processed"
                          ? "bg-card text-emerald-600 shadow-sm"
                          : "bg-card text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label} {tab.count}
                  </button>
                ))}
              </div>

              {/* 필터 셀렉트 */}
              {detailCourses.length > 1 && (
                <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="text-[12px] border rounded-lg px-2 py-1 bg-background">
                  <option value="all">전체 강의</option>
                  {detailCourses.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
              {detailCohorts.length > 1 && (
                <select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)} className="text-[12px] border rounded-lg px-2 py-1 bg-background">
                  <option value="all">전체 기수</option>
                  {detailCohorts.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
              {detailSourceFields.length > 1 && (
                <select value={sourceFieldFilter} onChange={(e) => setSourceFieldFilter(e.target.value)} className="text-[12px] border rounded-lg px-2 py-1 bg-background">
                  <option value="all">전체 문항</option>
                  {detailSourceFields.map((f) => <option key={f} value={f}>{FIELD_LABELS[f] || f}</option>)}
                </select>
              )}
              <select value={sentimentFilter} onChange={(e) => setSentimentFilter(e.target.value as typeof sentimentFilter)} className="text-[12px] border rounded-lg px-2 py-1 bg-background">
                <option value="all">전체 평가</option>
                <option value="positive">긍정</option>
                <option value="negative">부정</option>
                <option value="neutral">미구분</option>
              </select>
              {viewMode === "processed" && (
                <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border ml-1">
                  <button
                    onClick={() => setProcessStatusFilter("all")}
                    className={`py-0.5 px-2 rounded-md text-[11px] font-semibold transition-colors ${processStatusFilter === "all" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >전체 {processedCount}</button>
                  {PROCESS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setProcessStatusFilter(processStatusFilter === opt.value ? "all" : opt.value)}
                      className={`py-0.5 px-2 rounded-md text-[11px] font-semibold transition-colors ${processStatusFilter === opt.value ? `bg-card shadow-sm ${opt.color}` : "text-muted-foreground hover:text-foreground"}`}
                    >{opt.label} {processStatusCounts[opt.value] || 0}</button>
                  ))}
                </div>
              )}

              {/* 엑셀 내보내기 */}
              <button onClick={exportToExcel} disabled={detailFiltered.length === 0} className="text-[12px] px-2.5 py-1 rounded-lg border hover:bg-accent transition-colors disabled:opacity-40 flex items-center gap-1">
                <Download className="w-3.5 h-3.5" />엑셀
              </button>

              {/* 복사 (선택 있을 때만) */}
              {selected.size > 0 && (
                <button onClick={copySelected} className="text-[12px] px-2.5 py-1 rounded-lg border hover:bg-accent transition-colors flex items-center gap-1">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "복사됨" : `${selected.size}건 복사`}
                </button>
              )}

              {/* 내용 검색 */}
              <div className="relative flex-1 min-w-[100px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <input type="text" value={detailSearch} onChange={(e) => setDetailSearch(e.target.value)} placeholder="내용 검색..." className="w-full pl-7 pr-2 py-1 text-[12px] border rounded-lg bg-background" />
              </div>
            </div>

            {/* 테마 카드 (있으면 표시) */}
            {themeCards.length > 0 && activeTag !== "all" && (
              <div className="px-5 py-3 border-b bg-indigo-50/30 space-y-2">
                <div className="text-[12px] font-semibold text-indigo-700 mb-2">테마 분석 결과</div>
                {themeCards.map((tc) => {
                  const isExpanded = expandedThemes.has(tc.theme.id);
                  return (
                    <div key={tc.theme.id} className="rounded-lg border bg-card overflow-hidden">
                      <button onClick={() => toggleTheme(tc.theme.id)} className="w-full p-3 flex items-center gap-2 text-left hover:bg-accent/50 transition-colors">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        <span className="font-semibold text-[13px]">{tc.theme.theme_name}</span>
                        <span className="text-[11px] text-muted-foreground">{tc.processedCount}/{tc.comments.length}건 처리</span>
                        <div className="flex-1" />
                        <div className="w-16 bg-muted rounded-full h-1.5 shrink-0">
                          <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${tc.comments.length > 0 ? (tc.processedCount / tc.comments.length) * 100 : 0}%` }} />
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="border-t px-3 py-2 text-[12px] text-muted-foreground max-h-[200px] overflow-y-auto divide-y">
                          {tc.comments.map((c) => (
                            <div key={c.id} className="py-1.5 flex items-center gap-2">
                              <span className={`shrink-0 ${isProcessed(c) ? "text-emerald-500" : "text-muted-foreground/30"}`}>
                                {isProcessed(c) ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-3.5 h-3.5 block rounded-full border" />}
                              </span>
                              <span className={isProcessed(c) ? "line-through opacity-50" : ""}>{c.original_text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 댓글 목록 */}
            <div className="h-[calc(100vh-420px)] overflow-y-auto">
              {detailFiltered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-[14px]">
                  {viewMode === "processed" ? "처리 완료된 피드백이 없습니다" : "미처리 피드백이 없습니다"}
                </div>
              ) : (
                <div className="divide-y">
                  {detailFiltered.map((comment) => {
                    const isChecked = selected.has(comment.id);
                    const processed = isProcessed(comment);
                    const transferFrom = transferOrigins[comment.id];

                    return (
                      <div key={comment.id} className={`py-2.5 px-3 rounded-lg border-b transition-all duration-300 flex ${
                        processed ? `opacity-70 ${PROCESS_CARD_BG[comment.process_status ?? ""] || "bg-muted/20"}` : isChecked ? "ring-2 ring-primary/30 bg-primary/3" : "bg-background"
                      }`}>
                        {/* 처리유형 좌측 색상 바 */}
                        {processed && comment.process_status && (
                          <div className={`w-[3px] rounded-full shrink-0 mr-2.5 ${PROCESS_BAR_COLORS[comment.process_status] || "bg-gray-300"}`} />
                        )}
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          {/* 체크박스 */}
                          <label className="mt-0.5 cursor-pointer shrink-0">
                            <input type="checkbox" checked={isChecked} onChange={() => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(comment.id)) next.delete(comment.id); else next.add(comment.id);
                                return next;
                              });
                            }} className="w-3.5 h-3.5 rounded border-muted-foreground/30 accent-primary" />
                          </label>

                          {/* 본문 */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] leading-relaxed">{comment.original_text}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[12px] text-muted-foreground">
                              <span className="font-semibold text-foreground/60">{comment.respondent}</span>
                              {comment._cohort && <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{comment._cohort}</span>}
                              <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{FIELD_LABELS[comment.source_field] || comment.source_field}</span>
                              {comment.sentiment && (
                                <span className={`text-[11px] py-0.5 px-1.5 rounded font-semibold ${
                                  comment.sentiment === "positive" ? "bg-emerald-100 text-emerald-700"
                                  : comment.sentiment === "negative" ? "bg-rose-100 text-rose-700"
                                  : "bg-muted text-foreground"
                                }`}>
                                  {comment.sentiment === "positive" ? "긍정" : comment.sentiment === "negative" ? "부정" : "미구분"}
                                </span>
                              )}
                              {/* 액션태그 뱃지 (전체 탭에서만) */}
                              {activeTag === "all" && comment.action_tag && (
                                <span className={`text-[11px] py-0.5 px-1.5 rounded font-semibold border ${getActionTagColor(comment.action_tag)}`}>
                                  {getActionTagLabel(comment.action_tag)}
                                </span>
                              )}
                              {/* 처리 상태 뱃지 */}
                              {processed && (
                                <span className={`text-[11px] py-0.5 px-1.5 rounded font-semibold border ${getProcessColor(comment.process_status)}`}>
                                  {getProcessLabel(comment.process_status)}
                                </span>
                              )}
                              {/* 이관 출처 뱃지 */}
                              {transferFrom && ACTION_ROLE_LABELS[transferFrom as ActionTag] && (
                                <span className="text-[11px] py-0.5 px-1.5 rounded font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                                  {ACTION_ROLE_LABELS[transferFrom as ActionTag]}에서 이관
                                </span>
                              )}
                              {/* 처리 메모 */}
                              {comment.process_memo && (
                                <span className="text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                  메모: {comment.process_memo}
                                </span>
                              )}
                            </div>

                            {/* 메모 입력 (협의 필요) */}
                            {memoInputId === comment.id && (
                              <div className="mt-2 flex gap-2">
                                <input type="text" autoFocus value={memoText} onChange={(e) => setMemoText(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") handleProcessWithMemo(comment.id); if (e.key === "Escape") setMemoInputId(null); }}
                                  placeholder="협의 내용을 입력하세요 (필수)" className="flex-1 text-[13px] border rounded-lg px-3 py-1.5 bg-background" />
                                <button onClick={() => handleProcessWithMemo(comment.id)} className="text-[12px] px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700">저장</button>
                                <button onClick={() => setMemoInputId(null)} className="text-[12px] px-2 py-1.5 rounded-lg border hover:bg-accent">취소</button>
                              </div>
                            )}
                          </div>

                          {/* 오른쪽 액션 버튼 */}
                          <div className="flex items-center gap-0.5 shrink-0" ref={transferDropdownId === comment.id ? transferDropdownRef : undefined}>
                            {processed ? (
                              <button onClick={() => handleUndoProcess(comment.id)} className="text-[11px] px-2 py-1 rounded border text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1" title="처리 취소">
                                <Undo2 className="w-3 h-3" />되돌리기
                              </button>
                            ) : (
                              <>
                                {PROCESS_OPTIONS.map((opt) => {
                                  const isJust = justProcessed === `${comment.id}:${opt.value}`;
                                  return (
                                    <button key={opt.value} onClick={() => handleProcess(comment.id, opt.value)}
                                      className={`relative text-[11px] px-1.5 py-1 rounded border transition-all duration-300 ${isJust ? `${PROCESS_CHECK_COLORS[opt.value]} text-white scale-105` : opt.bgColor}`} title={opt.label}>
                                      <span className={isJust ? "invisible" : ""}>{opt.label}</span>
                                      {isJust && <Check className="w-3.5 h-3.5 absolute inset-0 m-auto" />}
                                    </button>
                                  );
                                })}
                              </>
                            )}
                            {/* 이관 */}
                            <div className="relative">
                              <button onClick={() => setTransferDropdownId(transferDropdownId === comment.id ? null : comment.id)}
                                className="text-[11px] px-1.5 py-1 rounded border transition-colors text-violet-600 bg-violet-50 hover:bg-violet-100 border-violet-200" title="이관">
                                다른 부서
                              </button>
                              {transferDropdownId === comment.id && (
                                <div className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-lg shadow-lg py-1 min-w-[120px]">
                                  {ACTION_TAG_ORDER.filter((r) => r !== comment.action_tag && r !== "no_action").map((r) => (
                                    <button key={r} onClick={() => transferComments([comment.id], r)}
                                      className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-accent transition-colors">
                                      {ACTION_ROLE_LABELS[r]}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 대량 액션 바 */}
            {selected.size > 0 && (
              <div className="flex items-center gap-3 py-3 px-5 border-t bg-muted/30">
                <span className="text-[13px] font-bold">{selected.size}건 선택됨</span>
                <button onClick={toggleSelectAll} className="text-[12px] text-primary font-semibold hover:underline">
                  {selected.size === detailFiltered.length ? "선택 해제" : "전체 선택"}
                </button>
                <button onClick={() => setSelected(new Set())} className="py-1 px-2.5 rounded-lg border text-[12px] hover:bg-accent transition-colors flex items-center gap-1">
                  <X className="w-3 h-3" />해제
                </button>
                <div className="flex-1" />
                {/* 대량 이관 */}
                <div className="relative" ref={transferDropdownId === "__bulk__" ? transferDropdownRef : undefined}>
                  <button onClick={() => setTransferDropdownId(transferDropdownId === "__bulk__" ? null : "__bulk__")}
                    className="py-1 px-3 rounded-lg bg-violet-600 text-white text-[12px] font-bold hover:bg-violet-700 transition-colors">
                    다른 부서로 이관
                  </button>
                  {transferDropdownId === "__bulk__" && (
                    <div className="absolute bottom-full mb-1 right-0 z-50 bg-card border rounded-lg shadow-lg py-1 min-w-[120px]">
                      {ACTION_TAG_ORDER.filter((r) => r !== "no_action").map((r) => (
                        <button key={r} onClick={() => transferComments(Array.from(selected), r)}
                          className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-accent transition-colors">
                          {ACTION_ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* 복사 */}
                <button onClick={copySelected}
                  className="py-1 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold hover:opacity-90 transition-opacity flex items-center gap-1">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "복사됨" : "원문 복사"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 공유 링크 다이얼로그 */}
        {shareDialogOpen && shareDialogTarget && (
          <ShareLinkDialog
            open={shareDialogOpen}
            platform={shareDialogTarget.platform}
            instructor={shareDialogTarget.instructor}
            cohorts={selectedSummary ? Array.from(new Set(selectedSummary.comments.map((c) => c._cohort).filter(Boolean))) : []}
            onClose={() => { setShareDialogOpen(false); setShareDialogTarget(null); }}
          />
        )}
      </div>
    </div>
  );
}
