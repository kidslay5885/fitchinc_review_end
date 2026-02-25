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
import type { Instructor } from "@/lib/types";
import { BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id: "overview", icon: "📈", label: "전체" },
  { id: "whole", icon: "📋", label: "전체 데이터" },
  { id: "feedback", icon: "🏷️", label: "세부 분류" },
  { id: "insight", icon: "💡", label: "AI 인사이트" },
  { id: "quality", icon: "📊", label: "강의 품질", onlyWhenAllCohorts: true },
];

function MainContent() {
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

  // 현재 보여줄 기수 목록
  const visibleCohorts = inst ? (course ? course.cohorts : allCohorts(inst)) : [];

  const [platDataLoading, setPlatDataLoading] = useState(false);

  // 플랫폼 선택 · 강사 미선택 시 전체 기수 데이터 병렬 로딩
  useEffect(() => {
    if (!showPlatDash || !plat) return;

    const allPlatCohorts = plat.instructors.flatMap((i) =>
      i.courses.flatMap((cr) => cr.cohorts.map((co) => ({ inst: i, course: cr, cohort: co })))
    );

    const needsLoad = allPlatCohorts.filter(
      ({ cohort: c }) =>
        (c.preResponses.length > 0 && c.preResponses[0]?.name === "") ||
        (c.postResponses.length > 0 && c.postResponses[0]?.name === "")
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
        const needsLoad =
          (cohort.preResponses.length > 0 && cohort.preResponses[0]?.name === "") ||
          (cohort.postResponses.length > 0 && cohort.postResponses[0]?.name === "");
        if (needsLoad) {
          // cohort가 속한 course 찾기
          const ownerCourse = inst.courses.find((c) => c.cohorts.some((co) => co.id === cohort.id));
          await loadCohortData(plat.name, inst.name, ownerCourse?.name || "", cohort.label);
        }
      } else {
        // 선택된 course의 기수만, 또는 전체 기수 병렬 로딩
        const promises = visibleCohorts
          .filter((c) =>
            (c.preResponses.length > 0 && c.preResponses[0]?.name === "") ||
            (c.postResponses.length > 0 && c.postResponses[0]?.name === "")
          )
          .map((c) => {
            const ownerCourse = inst.courses.find((cr) => cr.cohorts.some((co) => co.id === c.id));
            return loadCohortData(plat.name, inst.name, ownerCourse?.name || "", c.label);
          });
        await Promise.all(promises);
      }
      setDataLoading(false);
    };

    loadData();
  }, [inst?.id, course?.id, cohort?.id, plat?.name]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {editInst && (
        <EditInstructorDialog
          instructor={editInst}
          platformName={platformName}
          onSave={(updated) => {
            dispatch({ type: "UPDATE_INSTRUCTOR", instructor: updated });
            if (plat) {
              const payload = { photo: updated.photo || "", photoPosition: updated.photoPosition || "center 2%" };
              // localStorage 저장 (즉시, 서버 실패 시 백업)
              try {
                localStorage.setItem(
                  `instructor-photo-${plat.name}-${updated.name}`,
                  JSON.stringify(payload)
                );
              } catch {
                // quota 초과 시 무시
              }
              // 서버 저장 (비동기, 결과 피드백)
              fetch("/api/app-settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "instructor_photo",
                  platform: plat.name,
                  instructor: updated.name,
                  photo: payload.photo,
                  photoPosition: payload.photoPosition,
                }),
              })
                .then((res) => res.json())
                .then((data) => {
                  if (!data.ok) throw new Error("server returned ok:false");
                  toast.success("강사 정보 저장 완료");
                })
                .catch((err) => {
                  console.error("강사 사진 서버 저장 실패:", err);
                  toast.error("서버 저장 실패 — 새로고침 시 사진이 사라질 수 있습니다");
                });
            }
          }}
          onDelete={(id) => dispatch({ type: "DELETE_INSTRUCTOR", id })}
          onClose={() => setEditInst(null)}
          onRefresh={refreshHierarchy}
        />
      )}

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}

      <NavHeader />

      <div className="flex" style={{ height: "calc(100vh - 45px)" }}>
        <AppSidebar
          onUpload={() => setShowUpload(true)}
          onEditInstructor={(inst) => setEditInst(inst)}
        />

        <main className="flex-1 overflow-y-auto p-6 px-8 min-w-0">
          <div className="w-full max-w-[1400px]">
            {!state.selectedPlatformId && (
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
                  platformName={platformName}
                  instructor={inst}
                  course={course}
                  cohort={cohort}
                  onUpdateCohort={
                    cohort
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

                <div className="flex gap-0 border-b-2 border-border mb-5">
                  {TABS.filter((t) => !("onlyWhenAllCohorts" in t && t.onlyWhenAllCohorts) || !cohort).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => dispatch({ type: "SET_TAB", tab: t.id })}
                      className={`py-2.5 px-4 text-[14px] transition-colors -mb-[2px] ${
                        state.activeTab === t.id
                          ? "font-bold text-primary border-b-[2.5px] border-b-primary"
                          : "text-muted-foreground border-b-[2.5px] border-b-transparent hover:text-foreground"
                      }`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>

                {dataLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                    <div className="text-[13px] text-muted-foreground">데이터 로딩 중...</div>
                  </div>
                ) : (
                  <>
                    {state.activeTab === "overview" && (
                      <TabOverview
                        instructor={inst}
                        course={course}
                        cohort={cohort}
                        platformName={platformName}
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
                    {(state.activeTab === "feedback" || (state.activeTab === "quality" && cohort)) && (
                      <TabFeedbackHub instructor={inst} course={course} cohort={cohort} platformName={platformName} />
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
          </div>
        </main>
      </div>
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
