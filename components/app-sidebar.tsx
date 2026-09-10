"use client";

import { useState } from "react";
import { useAppStore, useSelectedPlatform } from "@/hooks/use-app-store";
import { Settings, Upload, ChevronDown, ChevronUp, User, GripVertical } from "lucide-react";
import type { Instructor, Cohort } from "@/lib/types";

interface AppSidebarProps {
  onUpload: () => void;
  onEditInstructor: (inst: Instructor) => void;
  readOnly?: boolean;
}

/** Extract numeric part for natural sort ("1기" -> 1, "10기" -> 10, "주언규" -> 999999) */
function cohortSortNum(label: string): number {
  const m = label.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 999999;
}

export function AppSidebar({ onUpload, onEditInstructor, readOnly }: AppSidebarProps) {
  const { state, dispatch } = useAppStore();
  const plat = useSelectedPlatform();
  const [zoomPhoto, setZoomPhoto] = useState<{ src: string; name: string; pos: string } | null>(null);

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
                    <div
                      className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ${instructor.photo ? "cursor-pointer hover:ring-2 hover:ring-primary/30" : ""}`}
                      onClick={instructor.photo ? (e) => {
                        e.stopPropagation();
                        setZoomPhoto({ src: instructor.photo, name: instructor.name, pos: instructor.photoPosition || "center 2%" });
                      } : undefined}
                    >
                      {instructor.photo ? (
                        <img
                          src={instructor.photo}
                          alt={instructor.name}
                          className="w-full h-full object-contain"
                          style={{ objectPosition: instructor.photoPosition || "center 2%" }}
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
                          platforms: state.platforms,
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
                        {!readOnly && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditInstructor(instructor);
                            }}
                            className="text-muted-foreground cursor-pointer opacity-50 hover:opacity-100 shrink-0"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate" title={(instructor.courses || []).map((c) => c.name).join(" · ")}>
                        {(() => {
                          const courses = instructor.courses || [];
                          if (courses.length === 0) return instructor.category || "";
                          // Find course containing the lowest-numbered cohort (1기)
                          let bestName = courses[0].name;
                          let bestNum = Infinity;
                          for (const c of courses) {
                            for (const ch of c.cohorts) {
                              const n = cohortSortNum(ch.label);
                              if (n < bestNum) { bestNum = n; bestName = c.name; }
                            }
                          }
                          return bestName;
                        })()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({
                          type: "SELECT_INSTRUCTOR",
                          id: isSel ? null : instructor.id,
                          platforms: state.platforms,
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

                  {/* Flat cohort list (all courses merged) */}
                  {isSel && plat && instructor.courses.length > 0 && (
                    <FlatCohortList
                      instructor={instructor}
                      selectedCohortId={state.selectedCohortId}
                      dispatch={dispatch}
                      readOnly={readOnly}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload button (분류작업 모드에서만) */}
      {!readOnly && (
        <div className="p-3 border-t">
          <button
            onClick={onUpload}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold cursor-pointer flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <Upload className="w-3.5 h-3.5" />
            업로드
          </button>
        </div>
      )}
      {/* Photo zoom overlay */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 cursor-pointer"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={zoomPhoto.src}
              alt={zoomPhoto.name}
              className="w-72 h-72 rounded-2xl object-contain bg-white shadow-2xl"
              style={{ objectPosition: zoomPhoto.pos }}
            />
            <div className="mt-2 text-center text-white text-sm font-semibold">{zoomPhoto.name}</div>
          </div>
        </div>
      )}
    </aside>
  );
}

/** Flat cohort list across all courses, sorted by cohort number */
function FlatCohortList({
  instructor,
  selectedCohortId,
  dispatch,
  readOnly = false,
}: {
  instructor: Instructor;
  selectedCohortId: string | null;
  dispatch: ReturnType<typeof useAppStore>["dispatch"];
  readOnly?: boolean;
}) {
  const hasMultiCourse = instructor.courses.length > 1;

  // Flatten all cohorts from all courses, carry parent course info
  const flatCohorts: (Cohort & { courseId: string; courseName: string })[] = [];
  for (const course of instructor.courses) {
    for (const cohort of course.cohorts) {
      flatCohorts.push({ ...cohort, courseId: course.id, courseName: course.name });
    }
  }

  // Natural sort by cohort label number
  flatCohorts.sort((a, b) => cohortSortNum(a.label) - cohortSortNum(b.label));

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
    // Drag reorder is visual only for flat list (no persist for now)
  };

  return (
    <div className="pl-7 py-1.5 space-y-0.5">
      {/* "전체 보기" */}
      <div
        onClick={() => {
          dispatch({ type: "SELECT_COURSE", id: null });
          dispatch({ type: "SELECT_COHORT", id: null });
        }}
        className={`py-1.5 px-2.5 rounded-md text-[12px] border-l-2 min-h-[32px] flex items-center cursor-pointer ${
          !selectedCohortId
            ? "font-semibold text-primary bg-primary/5 border-l-primary"
            : "text-muted-foreground border-l-transparent hover:bg-accent"
        }`}
      >
        전체 보기
      </div>

      {flatCohorts.map((c, index) => {
        const isSelCo = selectedCohortId === c.id;
        // Show course name when instructor has multiple courses
        const showCourseName = hasMultiCourse && c.courseName;

        return (
          <div
            key={c.id}
            draggable={!readOnly}
            onDragStart={readOnly ? undefined : (e) => handleDragStart(e, index)}
            onDragOver={readOnly ? undefined : handleDragOver}
            onDrop={readOnly ? undefined : (e) => handleDrop(e, index)}
            onClick={() => {
              dispatch({ type: "SELECT_COURSE", id: c.courseId });
              dispatch({ type: "SELECT_COHORT", id: c.id });
            }}
            className={`group py-1.5 px-2.5 rounded-md text-[12px] border-l-2 min-h-[32px] flex items-center gap-1 cursor-pointer ${
              isSelCo
                ? "bg-primary/5 border-l-primary font-semibold text-primary"
                : "border-l-transparent hover:bg-accent"
            }`}
          >
            {!readOnly && <span
              className="shrink-0 opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
              title="드래그하여 순서 변경"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </span>}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex justify-between items-center gap-1">
                <span
                  className={`truncate ${isSelCo ? "font-semibold text-primary" : ""}`}
                  title={showCourseName ? `${c.label} · ${c.courseName}` : String(c.label || "")}
                >
                  {String(c.label || "")}
                </span>
                <span className="inline-flex items-center gap-0.5 shrink-0" title={`사전 ${c.hasPreSurvey ? (((Array.isArray(c.preResponses) ? c.preResponses.length : 0) || c.preCount || 0) > 0 ? ((Array.isArray(c.preResponses) ? c.preResponses.length : 0) || c.preCount) + "명" : "없음") : "미업로드"} · 후기 ${c.hasPostSurvey ? (((Array.isArray(c.postResponses) ? c.postResponses.length : 0) || c.postCount || 0) > 0 ? ((Array.isArray(c.postResponses) ? c.postResponses.length : 0) || c.postCount) + "명" : "없음") : "미업로드"}`}>
                  <span className={`w-[7px] h-[7px] rounded-full ${(Array.isArray(c.preResponses) ? c.preResponses.length : 0) > 0 ? "bg-emerald-500" : c.hasPreSurvey ? "bg-amber-400" : "bg-muted-foreground/25"}`} />
                  <span className={`w-[7px] h-[7px] rounded-full ${(Array.isArray(c.postResponses) ? c.postResponses.length : 0) > 0 ? "bg-emerald-500" : c.hasPostSurvey ? "bg-amber-400" : "bg-muted-foreground/25"}`} />
                </span>
              </div>
              {/* Course name in small text (only for multi-course instructors) */}
              {showCourseName && (
                <div className="text-[10px] text-muted-foreground truncate leading-tight" title={c.courseName}>
                  {c.courseName}
                </div>
              )}
              {c.pm && (
                <div className="mt-0.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/70 text-[9px]">
                    <span className="text-muted-foreground">PM</span>
                    <span className="font-semibold text-foreground/80">{String(c.pm || "")}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
