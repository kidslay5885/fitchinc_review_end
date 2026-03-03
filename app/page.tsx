"use client";

import { useState, useEffect } from "react";
import {
  AppProvider,
  useAppStore,
  useSelectedPlatform,
  useSelectedInstructor,
  useSelectedCourse,
  useSelectedCohort,
} from "@/hooks/use-app-store";
import { allCohorts } from "@/lib/types";
import { NavHeader } from "@/components/nav-header";
import { AppSidebar } from "@/components/app-sidebar";
import { PlatformDashboard } from "@/components/platform-dashboard";
import { InstructorHero } from "@/components/instructor-hero";
import { TabOverview } from "@/components/tab-overview";
import { TabWhole } from "@/components/tab-whole";
import { TabFeedbackHub } from "@/components/tab-feedback-hub";
import { TabAIInsight } from "@/components/tab-ai-insight";
import { TabQualityOverview } from "@/components/tab-quality-overview";
import { UploadDialog } from "@/components/upload-dialog";
import { EditInstructorDialog } from "@/components/edit-instructor-dialog";
import { RoleFeedbackView } from "@/components/role-feedback-view";
import type { Instructor } from "@/lib/types";
import { SuggestionsPanel } from "@/components/suggestions-panel";
import { BarChart3, Loader2, Lock, MessageSquare, Tag, Send } from "lucide-react";
import { toast } from "sonner";

type AppMode = "landing" | "data" | "role" | "classify";

const TABS_DATA = [
  { id: "overview", icon: "📈", label: "전체" },
  { id: "whole", icon: "📋", label: "전체 설문 정보" },
  { id: "feedback", icon: "🏷️", label: "세부 설문 정보" },
  { id: "insight", icon: "💡", label: "AI 인사이트" },
  { id: "quality", icon: "📊", label: "전체 요약", onlyWhenAllCohorts: true },
];

const TABS_CLASSIFY = [
  { id: "overview", icon: "📈", label: "전체" },
  { id: "feedback", icon: "🏷️", label: "세부 분류" },
];

function LandingScreen({
  onSelectMode,
  classifyUnlocked,
}: {
  onSelectMode: (mode: AppMode) => void;
  classifyUnlocked: boolean;
}) {
  const [showPw, setShowPw] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  const handleClassifyClick = () => {
    if (classifyUnlocked) {
      onSelectMode("classify");
    } else {
      setShowPw(true);
    }
  };

  const handlePwSubmit = () => {
    if (pwInput === "1235") {
      onSelectMode("classify");
      setShowPw(false);
      setPwInput("");
      setPwError(false);
    } else {
      setPwError(true);
    }
  };

  const cards = [
    {
      mode: "data" as AppMode,
      icon: <BarChart3 className="w-8 h-8" />,
      title: "전체 설문 정보",
      desc: "플랫폼·강사·기수별\n설문 분석",
      color: "text-blue-600",
      bg: "hover:border-blue-300 hover:bg-blue-50/50",
    },
    {
      mode: "role" as AppMode,
      icon: <MessageSquare className="w-8 h-8" />,
      title: "직무별 피드백",
      desc: "PM / PD / CS / 강사\n직무별 피드백 조회",
      color: "text-violet-600",
      bg: "hover:border-violet-300 hover:bg-violet-50/50",
    },
    {
      mode: "classify" as AppMode,
      icon: <Tag className="w-8 h-8" />,
      title: "분류 작업",
      desc: "피드백 분석 및 분류",
      color: "text-amber-600",
      bg: "hover:border-amber-300 hover:bg-amber-50/50",
      locked: !classifyUnlocked,
    },
  ];

  return (
    <>
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-[720px] w-full">
          {cards.map((card) => (
            <button
              key={card.mode}
              onClick={() => (card.mode === "classify" ? handleClassifyClick() : onSelectMode(card.mode))}
              className={`relative flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-border bg-card transition-all duration-200 ${card.bg} cursor-pointer group`}
            >
              <div className={`${card.color} transition-transform group-hover:scale-110`}>
                {card.icon}
              </div>
              <span className="text-[16px] font-extrabold">{card.title}</span>
              <span className="text-[13px] text-muted-foreground text-center leading-snug whitespace-pre-line">
                {card.desc}
              </span>
              {card.locked && (
                <Lock className="absolute top-3 right-3 w-4 h-4 text-muted-foreground/50" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 비밀번호 다이얼로그 */}
      {showPw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-xl border shadow-xl p-6 w-[340px]">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-amber-600" />
              <span className="text-[15px] font-bold">분류작업 비밀번호</span>
            </div>
            <input
              type="password"
              autoFocus
              value={pwInput}
              onChange={(e) => {
                setPwInput(e.target.value);
                setPwError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handlePwSubmit();
              }}
              placeholder="비밀번호 입력"
              className={`w-full py-2 px-3 rounded-lg border text-[14px] bg-background ${
                pwError ? "border-red-400 ring-1 ring-red-400" : ""
              }`}
            />
            {pwError && (
              <p className="text-[12px] text-red-500 mt-1.5">비밀번호가 틀렸습니다</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handlePwSubmit}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity"
              >
                확인
              </button>
              <button
                onClick={() => {
                  setShowPw(false);
                  setPwInput("");
                  setPwError(false);
                }}
                className="flex-1 py-2 rounded-lg border text-[13px] text-muted-foreground hover:bg-accent transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DashboardContent({ tabs, readOnly = false }: { tabs: typeof TABS_DATA; readOnly?: boolean }) {
  const { state, dispatch, loadCohortData, refreshHierarchy } = useAppStore();
  const plat = useSelectedPlatform();
  const inst = useSelectedInstructor();
  const course = useSelectedCourse();
  const cohort = useSelectedCohort();

  const [showUpload, setShowUpload] = useState(false);
  const [editInst, setEditInst] = useState<Instructor | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const showPlatDash = plat && !inst;
  const platformName = plat?.name || "";
  const visibleCohorts = inst ? (course ? (course.cohorts || []) : allCohorts(inst)) : [];

  const [platDataLoading, setPlatDataLoading] = useState(false);

  // 플랫폼 선택 · 강사 미선택 시 전체 기수 데이터 병렬 로딩
  useEffect(() => {
    if (!showPlatDash || !plat) return;
    const allPlatCohorts = plat.instructors.flatMap((i) =>
      i.courses.flatMap((cr) => cr.cohorts.map((co) => ({ inst: i, course: cr, cohort: co })))
    );
    const needsLoad = allPlatCohorts.filter(
      ({ cohort: c }) => !c.dataLoaded && (c.hasPreSurvey || c.hasPostSurvey)
    );
    if (needsLoad.length === 0) {
      setPlatDataLoading(false);
      return;
    }
    setPlatDataLoading(true);
    Promise.all(
      needsLoad.map(({ inst: i, course: cr, cohort: co }) =>
        loadCohortData(plat.name, i.name, cr.name, co.label)
      )
    ).finally(() => setPlatDataLoading(false));
  }, [showPlatDash, plat?.id, plat?.instructors]);

  // 강사/기수 선택 시 실제 데이터 지연 로딩
  useEffect(() => {
    if (!inst || !plat) return;
    const loadData = async () => {
      setDataLoading(true);
      if (cohort) {
        const needsLoad = !cohort.dataLoaded && (cohort.hasPreSurvey || cohort.hasPostSurvey);
        if (needsLoad) {
          const ownerCourse = (inst.courses || []).find((c) => (c.cohorts || []).some((co) => co.id === cohort.id));
          await loadCohortData(plat.name, inst.name, ownerCourse?.name || "", cohort.label || "");
        }
      } else {
        const promises = visibleCohorts
          .filter((c) => !c.dataLoaded && (c.hasPreSurvey || c.hasPostSurvey))
          .map((c) => {
            const ownerCourse = (inst.courses || []).find((cr) => (cr.cohorts || []).some((co) => co.id === c.id));
            return loadCohortData(plat.name, inst.name, ownerCourse?.name || "", c.label);
          });
        await Promise.all(promises);
      }
      setDataLoading(false);
    };
    loadData();
  }, [inst?.id, course?.id, cohort?.id, plat?.name]);

  // 탭이 현재 목록에 없으면 첫 탭으로 리셋
  useEffect(() => {
    const tabIds = tabs.map((t) => t.id);
    if (!tabIds.includes(state.activeTab)) {
      dispatch({ type: "SET_TAB", tab: tabIds[0] });
    }
  }, [tabs, state.activeTab]);

  return (
    <>
      {editInst && (
        <EditInstructorDialog
          instructor={editInst}
          platformName={platformName}
          onSave={(updated) => {
            dispatch({ type: "UPDATE_INSTRUCTOR", instructor: updated });
            if (plat) {
              const payload = { photo: updated.photo || "", photoPosition: updated.photoPosition || "center 2%", category: updated.category || "" };
              try {
                localStorage.setItem(
                  `instructor-photo-${plat.name}-${updated.name}`,
                  JSON.stringify(payload)
                );
              } catch {}
              const saveBody = JSON.stringify({
                type: "instructor_photo",
                platform: plat.name,
                instructor: updated.name,
                photo: payload.photo,
                photoPosition: payload.photoPosition,
                category: payload.category,
              });
              const tryPost = async (attempt: number): Promise<void> => {
                try {
                  const res = await fetch("/api/app-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: saveBody });
                  const data = await res.json();
                  if (!data.ok) throw new Error(data.error || "server returned ok:false");
                  toast.success("강사 정보 저장 완료");
                } catch (err) {
                  if (attempt < 2) {
                    await new Promise((r) => setTimeout(r, 1500));
                    return tryPost(attempt + 1);
                  }
                  console.error("강사 사진 서버 저장 실패:", err);
                  toast.error("서버 저장 실패 — 새로고침 시 사진이 사라질 수 있습니다");
                }
              };
              tryPost(0);
            }
          }}
          onDelete={(id) => dispatch({ type: "DELETE_INSTRUCTOR", id })}
          onDeleteCourse={async (courseId, courseName) => {
            if (!editInst || !plat) return;
            const res = await fetch("/api/delete-course", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                platform: plat.name,
                instructor: editInst.name,
                course: courseName,
              }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "강의 삭제 실패");
            dispatch({ type: "DELETE_COURSE", instructorId: editInst.id, courseId });
            await refreshHierarchy();
            toast.success(result.message || "강의 삭제 완료");
          }}
          onClose={() => setEditInst(null)}
          onRefresh={refreshHierarchy}
        />
      )}

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}

      <div className="flex" style={{ height: "calc(100vh - 45px)" }}>
        <AppSidebar
          onUpload={() => setShowUpload(true)}
          onEditInstructor={(inst) => setEditInst(inst)}
          readOnly={readOnly}
        />

        <main className="flex-1 overflow-y-auto p-6 px-8 min-w-0">
          <div className="w-full max-w-[1400px]">
            {!state.selectedPlatformId && readOnly && (
              <div className="flex flex-col items-center justify-center h-full">
                <BarChart3 className="w-9 h-9 opacity-20 mb-3" />
                <div className="text-[15px] font-bold text-muted-foreground">
                  플랫폼을 선택하세요
                </div>
                <div className="text-[13px] text-muted-foreground mt-1">
                  좌측 사이드바에서 플랫폼을 선택하거나 파일을 업로드하세요
                </div>
              </div>
            )}

            {showPlatDash && (
              <PlatformDashboard
                platform={plat}
                dataLoading={platDataLoading}
              />
            )}

            {inst && (
              <div>
                <InstructorHero
                  key={inst.id}
                  platformName={platformName}
                  instructor={inst}
                  course={course}
                  cohort={cohort}
                  readOnly={readOnly}
                  classifyMode={!readOnly}
                  onUpdateCohort={
                    !readOnly
                      ? (c) => {
                          dispatch({ type: "UPDATE_COHORT", instructorId: inst.id, cohort: c });
                          if (plat)
                            try {
                              localStorage.setItem(
                                `total-students-${plat.name}-${inst.name}-${c.label}`,
                                String(c.totalStudents ?? 0)
                              );
                            } catch {}
                        }
                      : undefined
                  }
                />

                {tabs.length > 1 && <div className="flex gap-0 border-b-2 border-border mb-5">
                  {tabs.filter((t) => !("onlyWhenAllCohorts" in t && t.onlyWhenAllCohorts) || !cohort).map((t) => {
                    let label = t.label;
                    if (t.id === "whole") label = cohort ? "설문 정보" : "전체 설문 정보";
                    return (
                      <button
                        key={t.id}
                        onClick={() => dispatch({ type: "SET_TAB", tab: t.id })}
                        className={`py-2.5 px-4 text-[14px] transition-colors -mb-[2px] ${
                          state.activeTab === t.id
                            ? "font-bold text-primary border-b-[2.5px] border-b-primary"
                            : "text-muted-foreground border-b-[2.5px] border-b-transparent hover:text-foreground"
                        }`}
                      >
                        {t.icon} {label}
                      </button>
                    );
                  })}
                </div>}

                {dataLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    <div className="text-[13px] text-muted-foreground">데이터 로딩 중...</div>
                  </div>
                ) : (
                  <>
                    {state.activeTab === "overview" && (
                      <TabOverview
                        key={`overview-${inst.id}`}
                        instructor={inst}
                        course={course}
                        cohort={cohort}
                        platformName={platformName}
                        readOnly={readOnly}
                      />
                    )}
                    {state.activeTab === "whole" && (
                      <TabWhole
                        instructor={inst}
                        course={course}
                        platformName={platformName}
                        selectedCohort={cohort}
                        onGoToQuality={() => dispatch({ type: "SET_TAB", tab: "quality" })}
                      />
                    )}
                    {state.activeTab === "feedback" && (
                      <TabFeedbackHub
                        instructor={inst}
                        course={course}
                        cohort={cohort}
                        platformName={platformName}
                        readOnly={readOnly}
                      />
                    )}
                    {state.activeTab === "insight" && (
                      <TabAIInsight
                        instructor={inst}
                        course={course}
                        cohort={cohort}
                        platformName={platformName}
                        isActive
                      />
                    )}
                    {state.activeTab === "quality" && !cohort && (
                      <TabQualityOverview instructor={inst} course={course} platformName={platformName} />
                    )}
                  </>
                )}
              </div>
            )}

            {/* 건의함: 분류작업 모드 + 아무것도 미선택 시 바로 표시 */}
            {!inst && !readOnly && !plat && <SuggestionsPanel />}
          </div>
        </main>
      </div>
    </>
  );
}

function SuggestionFab() {
  const [showModal, setShowModal] = useState(false);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      toast.success("건의사항이 전달되었습니다");
      setContent("");
      setShowModal(false);
    } catch {
      toast.error("건의사항 제출에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity text-[14px] font-bold"
      >
        <Send className="w-4 h-4" />
        건의함
      </button>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/20 z-[200] flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-card rounded-xl border shadow-xl p-6 w-[400px] max-w-[90vw]">
            <div className="flex items-center gap-2 mb-4">
              <Send className="w-5 h-5 text-primary" />
              <span className="text-[15px] font-bold">건의함</span>
            </div>
            <p className="text-[13px] text-muted-foreground mb-3">
              익명으로 건의사항을 전달할 수 있습니다.
            </p>
            <textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="건의사항을 입력해주세요..."
              rows={5}
              className="w-full py-2.5 px-3 rounded-lg border text-[14px] bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || submitting}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {submitting ? "제출 중..." : "제출"}
              </button>
              <button
                onClick={() => { setShowModal(false); setContent(""); }}
                className="flex-1 py-2.5 rounded-lg border text-[13px] text-muted-foreground hover:bg-accent transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MainContent() {
  const { state } = useAppStore();
  const [appMode, setAppMode] = useState<AppMode>("landing");
  const [classifyUnlocked, setClassifyUnlocked] = useState(false);

  const handleSelectMode = (mode: AppMode) => {
    if (mode === "classify" && !classifyUnlocked) {
      setClassifyUnlocked(true);
    }
    setAppMode(mode);
  };

  const handleGoHome = () => {
    setAppMode("landing");
  };

  if (state.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <div className="text-[14px] text-muted-foreground">데이터 로딩 중...</div>
        </div>
      </div>
    );
  }

  const showFab = appMode !== "classify";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <NavHeader
        onHome={handleGoHome}
        appMode={appMode}
        onChangeMode={handleSelectMode}
      />

      {appMode === "landing" && (
        <LandingScreen
          onSelectMode={handleSelectMode}
          classifyUnlocked={classifyUnlocked}
        />
      )}

      {appMode === "data" && <DashboardContent tabs={TABS_DATA} readOnly />}

      {appMode === "classify" && <DashboardContent tabs={TABS_CLASSIFY} />}

      {appMode === "role" && <RoleFeedbackView />}

      {showFab && <SuggestionFab />}
    </div>
  );
}

export default function Page() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
