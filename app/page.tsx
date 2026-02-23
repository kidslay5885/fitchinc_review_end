"use client";

import { useState } from "react";
import {
  AppProvider,
  useAppStore,
  useSelectedPlatform,
  useSelectedInstructor,
  useSelectedCohort,
} from "@/hooks/use-app-store";
import { AppSidebar } from "@/components/app-sidebar";
import { PlatformDashboard } from "@/components/platform-dashboard";
import { InstructorHero } from "@/components/instructor-hero";
import { TabOverview } from "@/components/tab-overview";
import { TabRawResponses } from "@/components/tab-raw-responses";
import { TabAnalysis } from "@/components/tab-analysis";
import { TabPMNotes } from "@/components/tab-pm-notes";
import { TabFeedback } from "@/components/tab-feedback";
import { UploadDialog } from "@/components/upload-dialog";
import { EditInstructorDialog } from "@/components/edit-instructor-dialog";
import type { Instructor } from "@/lib/types";
import { BarChart3 } from "lucide-react";

const TABS = [
  { id: "overview", icon: "📊", label: "수강생 개요" },
  { id: "raw", icon: "📋", label: "응답 원본" },
  { id: "analysis", icon: "🔍", label: "분석 & 이슈" },
  { id: "notes", icon: "📝", label: "PM 워크노트" },
  { id: "feedback", icon: "💬", label: "강사 피드백" },
];

function MainContent() {
  const { state, dispatch } = useAppStore();
  const plat = useSelectedPlatform();
  const inst = useSelectedInstructor();
  const cohort = useSelectedCohort();

  const [showUpload, setShowUpload] = useState(false);
  const [editInst, setEditInst] = useState<Instructor | null>(null);

  const showPlatDash = plat && !inst;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Edit instructor modal */}
      {editInst && (
        <EditInstructorDialog
          instructor={editInst}
          onSave={(updated) => dispatch({ type: "UPDATE_INSTRUCTOR", instructor: updated })}
          onDelete={(id) => dispatch({ type: "DELETE_INSTRUCTOR", id })}
          onClose={() => setEditInst(null)}
        />
      )}

      {/* Upload modal */}
      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} />}

      {/* Header */}
      <header className="py-2.5 px-5 border-b flex items-center bg-card">
        <div className="w-[26px] h-[26px] rounded-md bg-primary flex items-center justify-center text-[12px] font-black text-primary-foreground mr-2.5">
          F
        </div>
        <span className="text-[15px] font-extrabold">클래스 인사이트</span>
      </header>

      <div className="flex" style={{ height: "calc(100vh - 50px)" }}>
        {/* Sidebar */}
        <AppSidebar
          onUpload={() => setShowUpload(true)}
          onEditInstructor={(inst) => setEditInst(inst)}
        />

        {/* Main area */}
        <main className="flex-1 overflow-y-auto p-5 px-6">
          {/* No platform selected */}
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

          {/* Platform dashboard */}
          {showPlatDash && (
            <PlatformDashboard
              platform={plat}
              onSelectInstructor={(id) => dispatch({ type: "SELECT_INSTRUCTOR", id })}
            />
          )}

          {/* Instructor view */}
          {inst && (
            <div>
              <InstructorHero
                platformName={plat?.name || ""}
                instructor={inst}
                cohort={cohort}
              />

              {/* Tabs */}
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

              {/* Tab content */}
              {state.activeTab === "overview" && (
                <TabOverview instructor={inst} cohort={cohort} />
              )}
              {state.activeTab === "raw" && (
                <TabRawResponses instructor={inst} cohort={cohort} />
              )}
              {state.activeTab === "analysis" && (
                <TabAnalysis instructor={inst} cohort={cohort} />
              )}
              {state.activeTab === "notes" && (
                <TabPMNotes instructor={inst} cohort={cohort} />
              )}
              {state.activeTab === "feedback" && (
                <TabFeedback instructor={inst} cohort={cohort} />
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
