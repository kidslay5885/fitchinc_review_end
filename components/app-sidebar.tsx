"use client";

import { useState } from "react";
import { useAppStore, useSelectedPlatform } from "@/hooks/use-app-store";
import { autoStatus, statusBg } from "@/lib/types";
import { getOrderedCohorts, setCohortOrder } from "@/lib/cohort-order";
import { Settings, Upload, ChevronDown, ChevronUp, User, GripVertical } from "lucide-react";
import type { Instructor } from "@/lib/types";

interface AppSidebarProps {
  onUpload: () => void;
  onEditInstructor: (inst: Instructor) => void;
}

export function AppSidebar({ onUpload, onEditInstructor }: AppSidebarProps) {
  const { state, dispatch } = useAppStore();
  const plat = useSelectedPlatform();
  const [orderKey, setOrderKey] = useState(0);

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
                          className="w-full h-full object-contain"
                          style={{ objectPosition: instructor.photoPosition || "center top" }}
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
                      className={`flex-1 py-2 px-2 rounded-lg cursor-pointer transition-colors min-w-0 ${
                        isSel
                          ? "bg-primary/5 border border-primary/15"
                          : "border border-transparent hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[14px] flex-1 truncate ${isSel ? "font-bold" : "font-medium"}`}
                        >
                          {instructor.name}
                        </span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditInstructor(instructor);
                          }}
                          className="text-muted-foreground cursor-pointer opacity-50 hover:opacity-100 shrink-0"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{instructor.category}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({
                          type: "SELECT_INSTRUCTOR",
                          id: isSel ? null : instructor.id,
                        });
                      }}
                      className="shrink-0 p-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                      aria-label={isSel ? "접기" : "펼치기"}
                    >
                      {isSel ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Cohorts: 전체 보기 / 기수 (저장된 순서, 드래그로 순서 변경) */}
                  {isSel && plat && (() => {
                    const ordered = getOrderedCohorts(plat.name, instructor.name, instructor.cohorts);
                    const handleDragStart = (e: React.DragEvent, index: number) => {
                      e.dataTransfer.setData("text/plain", String(index));
                      e.dataTransfer.effectAllowed = "move";
                    };
                    const handleDragOver = (e: React.DragEvent) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    };
                    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
                      e.preventDefault();
                      const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
                      if (isNaN(from) || from === dropIndex) return;
                      const labels = [...ordered.map((c) => c.label)];
                      const [removed] = labels.splice(from, 1);
                      labels.splice(dropIndex, 0, removed);
                      setCohortOrder(plat.name, instructor.name, labels);
                      setOrderKey((k) => k + 1);
                      fetch("/api/app-settings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          type: "cohort_order",
                          platform: plat.name,
                          instructor: instructor.name,
                          labels,
                        }),
                      }).catch(() => {});
                    };
                    return (
                      <div className="pl-7 py-1.5 space-y-0.5">
                        <div
                          onClick={() => dispatch({ type: "SELECT_COHORT", id: null })}
                          className={`py-1.5 px-2.5 rounded-md text-[12px] cursor-pointer border-l-2 min-h-[32px] flex items-center ${
                            !state.selectedCohortId
                              ? "font-semibold text-primary bg-primary/5 border-l-primary"
                              : "text-muted-foreground border-l-transparent hover:bg-accent"
                          }`}
                        >
                          전체 보기
                        </div>
                        {ordered.map((c, index) => {
                          const status = autoStatus(c);
                          const isSelCo = state.selectedCohortId === c.id;
                          return (
                            <div
                              key={c.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, index)}
                              onDragOver={handleDragOver}
                              onDrop={(e) => handleDrop(e, index)}
                              onClick={() => dispatch({ type: "SELECT_COHORT", id: c.id })}
                              className={`group py-1.5 px-2.5 rounded-md text-[12px] cursor-pointer border-l-2 min-h-[32px] flex items-center gap-1 ${
                                isSelCo
                                  ? "bg-primary/5 border-l-primary font-semibold text-primary"
                                  : "border-l-transparent hover:bg-accent"
                              }`}
                            >
                              <span
                                className="shrink-0 opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing text-muted-foreground"
                                onClick={(e) => e.stopPropagation()}
                                title="드래그하여 순서 변경"
                              >
                                <GripVertical className="w-3.5 h-3.5" />
                              </span>
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex justify-between items-center gap-1">
                                  <span className={isSelCo ? "font-semibold text-primary" : ""}>
                                    {c.label}
                                  </span>
                                  <span
                                    className={`text-[10px] px-1 py-0.5 rounded border font-bold shrink-0 ${statusBg(status)}`}
                                  >
                                    {status}
                                  </span>
                                </div>
                                {c.pm && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">담당PM {c.pm}</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
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
