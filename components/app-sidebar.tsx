"use client";

import { useState } from "react";
import { useAppStore, useSelectedPlatform } from "@/hooks/use-app-store";
import { autoStatus, statusBg, allCohorts } from "@/lib/types";
import { getOrderedCohorts, setCohortOrder } from "@/lib/cohort-order";
import { Settings, Upload, ChevronDown, ChevronUp, User, GripVertical, BookOpen } from "lucide-react";
import type { Instructor, Course } from "@/lib/types";

interface AppSidebarProps {
  onUpload: () => void;
  onEditInstructor: (inst: Instructor) => void;
  readOnly?: boolean;
}

export function AppSidebar({ onUpload, onEditInstructor, readOnly }: AppSidebarProps) {
  const { state, dispatch } = useAppStore();
  const plat = useSelectedPlatform();
  const [orderKey, setOrderKey] = useState(0);
  const [zoomPhoto, setZoomPhoto] = useState<{ src: string; name: string; pos: string } | null>(null);

  const hasMultipleCourses = (inst: Instructor) => inst.courses.length > 1;

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
              const multiCourse = hasMultipleCourses(instructor);
              const selectedCourse = instructor.courses.find((c) => c.id === state.selectedCourseId) || null;

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
                      <div className="text-[11px] text-muted-foreground">
                        {instructor.courses.length > 0
                          ? instructor.courses.map((c) => c.name || "기본 과정").join(" · ")
                          : instructor.category || ""}
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

                  {/* 강의 2개+: 강의 목록 → 강의 선택 시 기수 목록 */}
                  {isSel && plat && multiCourse && (
                    <div className="pl-7 py-1.5 space-y-0.5">
                      {/* 전체 보기 (모든 강의/기수) */}
                      <div
                        onClick={() => {
                          dispatch({ type: "SELECT_COURSE", id: null });
                          dispatch({ type: "SELECT_COHORT", id: null });
                        }}
                        className={`py-1.5 px-2.5 rounded-md text-[12px] border-l-2 min-h-[32px] flex items-center cursor-pointer ${
                          !state.selectedCourseId && !state.selectedCohortId
                            ? "font-semibold text-primary bg-primary/5 border-l-primary"
                            : "text-muted-foreground border-l-transparent hover:bg-accent"
                        }`}
                      >
                        전체 보기
                      </div>
                      {instructor.courses.map((course) => {
                        const isCourseSelected = state.selectedCourseId === course.id;
                        return (
                          <div key={course.id}>
                            <div
                              onClick={() => {
                                dispatch({ type: "SELECT_COURSE", id: isCourseSelected ? null : course.id });
                                dispatch({ type: "SELECT_COHORT", id: null });
                              }}
                              className={`py-1.5 px-2.5 rounded-md text-[12px] border-l-2 min-h-[32px] flex items-center gap-1 cursor-pointer ${
                                isCourseSelected
                                  ? "font-semibold text-primary bg-primary/5 border-l-primary"
                                  : "text-muted-foreground border-l-transparent hover:bg-accent"
                              }`}
                            >
                              <BookOpen className="w-3 h-3 shrink-0" />
                              <span className="truncate">{course.name || "기본 과정"}</span>
                            </div>

                            {/* 해당 강의의 기수 목록 */}
                            {isCourseSelected && (
                              <CohortList
                                plat={plat}
                                instructor={instructor}
                                course={course}
                                selectedCohortId={state.selectedCohortId}
                                dispatch={dispatch}
                                orderKey={orderKey}
                                setOrderKey={setOrderKey}
                                indent
                                readOnly={readOnly}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 강의 1개: 기존과 동일 (Course 레이어 숨김, 바로 기수 표시) */}
                  {isSel && plat && !multiCourse && instructor.courses.length === 1 && (
                    <CohortList
                      plat={plat}
                      instructor={instructor}
                      course={instructor.courses[0]}
                      selectedCohortId={state.selectedCohortId}
                      dispatch={dispatch}
                      orderKey={orderKey}
                      setOrderKey={setOrderKey}
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

/** 기수 목록 (드래그 재정렬 지원) */
function CohortList({
  plat,
  instructor,
  course,
  selectedCohortId,
  dispatch,
  orderKey,
  setOrderKey,
  indent = false,
  readOnly = false,
}: {
  plat: { name: string };
  instructor: Instructor;
  course: Course;
  selectedCohortId: string | null;
  dispatch: ReturnType<typeof useAppStore>["dispatch"];
  orderKey: number;
  setOrderKey: (fn: (k: number) => number) => void;
  indent?: boolean;
  readOnly?: boolean;
}) {
  const ordered = getOrderedCohorts(plat.name, instructor.name, course.name, course.cohorts);

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
    setCohortOrder(plat.name, instructor.name, course.name, labels);
    setOrderKey((k) => k + 1);
    fetch("/api/app-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "cohort_order",
        platform: plat.name,
        instructor: instructor.name,
        course: course.name,
        labels,
      }),
    }).catch(() => {});
  };

  return (
    <div className={`${indent ? "pl-4" : "pl-7"} py-1.5 space-y-0.5`}>
      {!indent && (
        <div
          onClick={() => dispatch({ type: "SELECT_COHORT", id: null })}
          className={`py-1.5 px-2.5 rounded-md text-[12px] border-l-2 min-h-[32px] flex items-center cursor-pointer ${
            !selectedCohortId
              ? "font-semibold text-primary bg-primary/5 border-l-primary"
              : "text-muted-foreground border-l-transparent hover:bg-accent"
          }`}
        >
          전체 보기
        </div>
      )}
      {ordered.map((c, index) => {
        const status = autoStatus(c);
        const isSelCo = selectedCohortId === c.id;
        return (
          <div
            key={c.id}
            draggable={!readOnly}
            onDragStart={readOnly ? undefined : (e) => handleDragStart(e, index)}
            onDragOver={readOnly ? undefined : handleDragOver}
            onDrop={readOnly ? undefined : (e) => handleDrop(e, index)}
            onClick={() => dispatch({ type: "SELECT_COHORT", id: c.id })}
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
                <span className={isSelCo ? "font-semibold text-primary" : ""}>
                  {c.label}
                </span>
                <span className="inline-flex items-center gap-0.5 shrink-0" title={`사전 ${c.hasPreSurvey ? c.preResponses.length + "명" : "미업로드"} · 후기 ${c.hasPostSurvey ? c.postResponses.length + "명" : "미업로드"}`}>
                  <span className={`w-[7px] h-[7px] rounded-full ${c.preResponses.length > 0 ? "bg-emerald-500" : c.hasPreSurvey ? "bg-amber-400" : "bg-muted-foreground/25"}`} />
                  <span className={`w-[7px] h-[7px] rounded-full ${c.postResponses.length > 0 ? "bg-emerald-500" : c.hasPostSurvey ? "bg-amber-400" : "bg-muted-foreground/25"}`} />
                </span>
              </div>
              {c.pm && (
                <div className="mt-0.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/70 text-[9px]">
                    <span className="text-muted-foreground">PM</span>
                    <span className="font-semibold text-foreground/80">{c.pm}</span>
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
