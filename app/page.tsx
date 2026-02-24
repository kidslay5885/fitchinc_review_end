"use client";

import { useState, useEffect } from "react";
import {
  AppProvider,
  useAppStore,
  useSelectedPlatform,
  useSelectedInstructor,
  useSelectedCohort,
} from "@/hooks/use-app-store";
import { NavHeader } from "@/components/nav-header";
import { AppSidebar } from "@/components/app-sidebar";
import { PlatformDashboard } from "@/components/platform-dashboard";
import { InstructorHero } from "@/components/instructor-hero";
import { TabFeedbackHub } from "@/components/tab-feedback-hub";
import { TabAnalysis } from "@/components/tab-analysis";
import { TabAIInsight } from "@/components/tab-ai-insight";
import { UploadDialog } from "@/components/upload-dialog";
import { EditInstructorDialog } from "@/components/edit-instructor-dialog";
import type { Instructor } from "@/lib/types";
import { BarChart3, Loader2 } from "lucide-react";

const TABS = [
  { id: "feedback", icon: "💬", label: "피드백" },
  { id: "analysis", icon: "📋", label: "분석" },
  { id: "insight", icon: "💡", label: "AI 인사이트" },
];

function MainContent() {
  const { state, dispatch, loadCohortData } = useAppStore();
  const plat = useSelectedPlatform();
  const inst = useSelectedInstructor();
  const cohort = useSelectedCohort();

  const [showUpload, setShowUpload] = useState(false);
  const [editInst, setEditInst] = useState<Instructor | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const showPlatDash = plat && !inst;
  const platformName = plat?.name || "";

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
          await loadCohortData(plat.name, inst.name, cohort.label);
        }
      } else {
        for (const c of inst.cohorts) {
          const needsLoad =
            (c.preResponses.length > 0 && c.preResponses[0]?.name === "") ||
            (c.postResponses.length > 0 && c.postResponses[0]?.name === "");
          if (needsLoad) {
            await loadCohortData(plat.name, inst.name, c.label);
          }
        }
      }
      setDataLoading(false);
    };

    loadData();
  }, [inst?.id, cohort?.id, plat?.name]);

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
          onSave={(updated) => dispatch({ type: "UPDATE_INSTRUCTOR", instructor: updated })}
          onDelete={(id) => dispatch({ type: "DELETE_INSTRUCTOR", id })}
          onClose={() => setEditInst(null)}
        />
      )}

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}

      <NavHeader />

      <div className="flex" style={{ height: "calc(100vh - 45px)" }}>
        <AppSidebar
          onUpload={() => setShowUpload(true)}
          onEditInstructor={(inst) => setEditInst(inst)}
        />

        <main className="flex-1 overflow-y-auto p-5 px-6">
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
              onSelectInstructor={(id) => dispatch({ type: "SELECT_INSTRUCTOR", id })}
            />
          )}

          {inst && (
            <div>
              <InstructorHero
                platformName={platformName}
                instructor={inst}
                cohort={cohort}
              />

              <div className="flex gap-0 border-b-2 border-border mb-5">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => dispatch({ type: "SET_TAB", tab: t.id })}
                    className={`py-2.5 px-4 text-[13px] transition-colors -mb-[2px] ${
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
                  {state.activeTab === "feedback" && (
                    <TabFeedbackHub instructor={inst} cohort={cohort} platformName={platformName} />
                  )}
                  {state.activeTab === "analysis" && (
                    <TabAnalysis instructor={inst} cohort={cohort} platformName={platformName} />
                  )}
                  {state.activeTab === "insight" && (
                    <TabAIInsight instructor={inst} cohort={cohort} platformName={platformName} />
                  )}
                </>
              )}
            </div>
          )}
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
