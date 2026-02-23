"use client";

import { useAppStore, useSelectedPlatform } from "@/hooks/use-app-store";
import { autoStatus, statusBg } from "@/lib/types";
import { Settings, Upload, ChevronDown, ChevronUp, User } from "lucide-react";
import type { Instructor } from "@/lib/types";

interface AppSidebarProps {
  onUpload: () => void;
  onEditInstructor: (inst: Instructor) => void;
}

export function AppSidebar({ onUpload, onEditInstructor }: AppSidebarProps) {
  const { state, dispatch } = useAppStore();
  const plat = useSelectedPlatform();

  return (
    <aside className="w-[260px] border-r bg-card overflow-y-auto flex-shrink-0 flex flex-col">
      <div className="flex-1">
        {/* Platform selector */}
        <div className="p-3 pb-2">
          <div className="text-[11px] font-extrabold text-muted-foreground mb-2 uppercase tracking-wider">
            플랫폼
          </div>
          <div className="flex gap-1">
            {state.platforms.map((p) => (
              <button
                key={p.id}
                onClick={() =>
                  dispatch({
                    type: "SELECT_PLATFORM",
                    id: state.selectedPlatformId === p.id ? null : p.id,
                  })
                }
                className={`flex-1 py-2 px-1 rounded-lg border text-[12px] font-bold cursor-pointer flex items-center justify-center transition-colors ${
                  state.selectedPlatformId === p.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Instructors */}
        {plat && (
          <div className="px-2 pb-2">
            {plat.instructors.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-[12px]">
                강사가 없습니다.
                <br />
                파일을 업로드하면 자동 추가됩니다.
              </div>
            )}
            {plat.instructors.map((instructor) => {
              const isSel = state.selectedInstructorId === instructor.id;
              return (
                <div key={instructor.id}>
                  <div className="flex items-center gap-1.5">
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                      {instructor.photo ? (
                        <img
                          src={instructor.photo}
                          alt={instructor.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    {/* Name + category */}
                    <div
                      onClick={() =>
                        dispatch({
                          type: "SELECT_INSTRUCTOR",
                          id: isSel ? null : instructor.id,
                        })
                      }
                      className={`flex-1 py-1.5 px-1.5 rounded-lg cursor-pointer transition-colors ${
                        isSel
                          ? "bg-primary/5 border border-primary/15"
                          : "border border-transparent hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[13px] flex-1 ${isSel ? "font-bold" : "font-medium"}`}
                        >
                          {instructor.name}
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditInstructor(instructor);
                          }}
                          className="text-muted-foreground cursor-pointer opacity-50 hover:opacity-100"
                        >
                          <Settings className="w-3 h-3" />
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">{instructor.category}</div>
                    </div>
                    {isSel && (
                      <span className="text-muted-foreground text-[10px]">
                        {isSel ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Cohorts */}
                  {isSel && (
                    <div className="pl-9 py-1">
                      <div
                        onClick={() => dispatch({ type: "SELECT_COHORT", id: null })}
                        className={`py-1 px-2 rounded text-[12px] cursor-pointer mb-0.5 border-l-[2.5px] ${
                          !state.selectedCohortId
                            ? "font-bold text-primary bg-primary/5 border-l-primary"
                            : "text-muted-foreground border-l-transparent hover:bg-accent"
                        }`}
                      >
                        전체 보기
                      </div>
                      {instructor.cohorts.map((c) => {
                        const status = autoStatus(c);
                        const isSelCo = state.selectedCohortId === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => dispatch({ type: "SELECT_COHORT", id: c.id })}
                            className={`py-1 px-2 rounded text-[12px] cursor-pointer mb-0.5 border-l-[2.5px] ${
                              isSelCo
                                ? "bg-primary/5 border-l-primary"
                                : "border-l-transparent hover:bg-accent"
                            }`}
                          >
                            <div className="flex justify-between">
                              <span className={isSelCo ? "font-bold text-primary" : ""}>
                                {c.label}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${statusBg(status)}`}
                              >
                                {status}
                              </span>
                            </div>
                            {c.pm && (
                              <div className="text-[10px] text-muted-foreground">담당PM {c.pm}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload button */}
      <div className="p-3 border-t">
        <button
          onClick={onUpload}
          className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold cursor-pointer flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <Upload className="w-3.5 h-3.5" />
          업로드
        </button>
      </div>
    </aside>
  );
}
