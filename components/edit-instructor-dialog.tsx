"use client";

import { useState } from "react";
import type { Instructor, Cohort } from "@/lib/types";
import { autoStatus, statusBg } from "@/lib/types";
import { X, User, Trash2, AlertTriangle, Pencil, Merge, Loader2, Square, CheckSquare, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

interface EditInstructorDialogProps {
  instructor: Instructor;
  platformName: string;
  onSave: (updated: Instructor) => void;
  onDelete: (id: string) => void;
  onDeleteCourse: (courseId: string, courseName: string) => Promise<void>;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function EditInstructorDialog({
  instructor,
  platformName,
  onSave,
  onDelete,
  onDeleteCourse,
  onClose,
  onRefresh,
}: EditInstructorDialogProps) {
  const [data, setData] = useState<Instructor>(() => {
    const copy: Instructor = JSON.parse(JSON.stringify(instructor));
    // 기수를 숫자 순으로 자동 정렬 (3기 → 4기 → 5기)
    for (const course of copy.courses) {
      course.cohorts.sort((a, b) => {
        const numA = parseInt((a.label || "").replace(/\D/g, "")) || 0;
        const numB = parseInt((b.label || "").replace(/\D/g, "")) || 0;
        return numA - numB;
      });
    }
    return copy;
  });
  const [confirmDel, setConfirmDel] = useState<null | "inst" | string>(null);

  // 강의명 편집 상태: courseIdx → 편집 중인 새 이름
  const [editingCourse, setEditingCourse] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  // 강의 삭제 확인: courseIdx
  const [confirmDelCourse, setConfirmDelCourse] = useState<number | null>(null);
  const [deletingCourse, setDeletingCourse] = useState(false);
  // 강의 병합: 체크된 인덱스 Set, 병합 대상 인덱스, 처리 중 플래그
  const [mergeSelected, setMergeSelected] = useState<Set<number>>(new Set());
  const [mergeTarget, setMergeTarget] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);
  // 플랫폼 이동: courseIdx
  const [movingPlatformIdx, setMovingPlatformIdx] = useState<number | null>(null);
  const [movingPlatform, setMovingPlatform] = useState(false);
  const PLATFORMS = ["핏크닉", "머니업클래스"];

  const updateCohort = (courseIdx: number, cohortIdx: number, field: keyof Cohort, value: string | number) => {
    setData((prev) => ({
      ...prev,
      courses: prev.courses.map((course, ci) =>
        ci === courseIdx
          ? {
              ...course,
              cohorts: course.cohorts.map((c, i) => (i === cohortIdx ? { ...c, [field]: value } : c)),
            }
          : course
      ),
    }));
  };

  const removeCohort = (courseIdx: number, cohortIdx: number) => {
    setData((prev) => ({
      ...prev,
      courses: prev.courses.map((course, ci) =>
        ci === courseIdx
          ? { ...course, cohorts: course.cohorts.filter((_, i) => i !== cohortIdx) }
          : course
      ),
    }));
  };

  const getCohortForConfirm = (key: string): Cohort | undefined => {
    const [ci, coI] = key.split("-").map(Number);
    return data.courses[ci]?.cohorts[coI];
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 256;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        const ratio = Math.min(MAX / w, MAX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/png");
      setData((prev) => ({ ...prev, photo: compressed }));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setData((prev) => ({ ...prev, photo: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const getVerticalPosition = (): number => {
    const pos = data.photoPosition || "center 2%";
    const parts = pos.split(" ");
    const yPart = parts[1] || "50%";
    return parseInt(yPart) || 50;
  };

  const setVerticalPosition = (value: number) => {
    setData((prev) => ({ ...prev, photoPosition: `center ${value}%` }));
  };

  // 강의명 적용 (로컬 상태만 변경, 서버 반영은 저장 시)
  const applyCourseRename = (courseIdx: number, newName: string) => {
    const trimmed = newName.trim();
    setEditingCourse((prev) => { const n = { ...prev }; delete n[courseIdx]; return n; });
    setData((prev) => ({
      ...prev,
      courses: prev.courses.map((c, i) => i === courseIdx ? { ...c, name: trimmed } : c),
    }));
  };

  // 저장: 강의명 변경 + 스케줄 변경 + 기타 정보 일괄 서버 반영
  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. 강의명 변경 처리
      let hasRename = false;
      for (let i = 0; i < data.courses.length && i < instructor.courses.length; i++) {
        const oldName = instructor.courses[i].name;
        const newName = data.courses[i].name;
        if (oldName !== newName) {
          hasRename = true;
          const res = await fetch("/api/rename-course", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform: platformName,
              instructor: instructor.name,
              oldCourse: oldName,
              newCourse: newName,
            }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || "강의명 변경 실패");
        }
      }

      // 2. 스케줄(PM, 시작일, VOD 종료일) 변경 처리
      for (let ci = 0; ci < data.courses.length && ci < instructor.courses.length; ci++) {
        const oldCourse = instructor.courses[ci];
        const newCourse = data.courses[ci];
        for (let coI = 0; coI < newCourse.cohorts.length && coI < oldCourse.cohorts.length; coI++) {
          const oldC = oldCourse.cohorts[coI];
          const newC = newCourse.cohorts[coI];
          const changes: Record<string, string> = {};
          if ((newC.pm || "") !== (oldC.pm || "")) changes.pm = newC.pm || "";
          if ((newC.date || "") !== (oldC.date || "")) changes.startDate = newC.date || "";
          if ((newC.endDate || "") !== (oldC.endDate || "")) changes.endDate = newC.endDate || "";
          if (Object.keys(changes).length > 0) {
            const res = await fetch("/api/update-schedule", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                platform: platformName,
                instructor: instructor.name,
                course: newCourse.name,
                cohort: newC.label,
                ...changes,
              }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "스케줄 저장 실패");
          }
        }
      }

      // 3. 사진/카테고리/기수 정보 저장
      onSave(data);

      // 4. 강의명 변경이 있을 때만 hierarchy 새로고침 (사진만 변경 시 불필요한 전체 리로드 방지)
      if (hasRename) {
        await onRefresh();
      }

      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "저장 실패";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const hasMultipleCourses = data.courses.length > 1;

  return (
    <div
      className="fixed inset-0 bg-black/20 z-[300] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-[14px] p-7 w-[640px] max-h-[80vh] overflow-y-auto shadow-xl border"
      >
        <div className="flex justify-between mb-5">
          <h3 className="text-[17px] font-extrabold">강사 정보 수정</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Basic info */}
        <div className="flex gap-4 mb-5 items-end">
          <div>
            <label className="text-[11px] text-muted-foreground font-bold block mb-1">프로필</label>
            <label className="cursor-pointer relative inline-block">
              <div className="w-[52px] h-[52px] rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-muted">
                {data.photo ? (
                  <img
                    src={data.photo}
                    alt={data.name}
                    className="w-full h-full object-cover"
                    style={{ objectPosition: data.photoPosition || "center 2%" }}
                  />
                ) : (
                  <User className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[9px] text-primary-foreground font-bold border-2 border-card">
                +
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground font-bold block mb-1">강사명</label>
            <input
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              className="py-1.5 px-3 rounded-lg border text-[14px] font-semibold w-[130px] bg-muted"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground font-bold block mb-1">카테고리</label>
            <input
              value={data.category}
              onChange={(e) => setData({ ...data, category: e.target.value })}
              className="py-1.5 px-3 rounded-lg border text-[14px] w-[180px] bg-muted"
            />
          </div>
        </div>

        {/* Photo position slider */}
        {data.photo && (
          <div className="mb-5 py-3 px-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-3">
              <label className="text-[11px] text-muted-foreground font-bold shrink-0">
                사진 위치
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={getVerticalPosition()}
                onChange={(e) => setVerticalPosition(Number(e.target.value))}
                className="flex-1 h-1.5 accent-primary cursor-pointer"
              />
              <span className="text-[11px] text-muted-foreground w-8 text-right">
                {getVerticalPosition()}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 px-[68px]">
              <span>위</span>
              <span>아래</span>
            </div>
          </div>
        )}

        {/* Course management — 강의명 편집/병합 */}
        {data.courses.length > 0 && (
          <div className="mb-5">
            <div className="text-[12px] font-bold text-muted-foreground mb-2 flex items-center gap-2">
              강의명 관리
              {hasMultipleCourses && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-100 border border-blue-200 rounded-full px-2 py-0.5">
                  <Merge className="w-3 h-3" />
                  이름을 같게 바꾸면 자동 병합
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              {data.courses.map((course, idx) => {
                const isEditing = editingCourse[idx] !== undefined;
                const editValue = editingCourse[idx] ?? "";
                const isRenamed = idx < instructor.courses.length && instructor.courses[idx].name !== course.name;
                const isChecked = mergeSelected.has(idx);
                const cohortCount = course.cohorts.length;
                const preCount = course.cohorts.filter((c) => c.hasPreSurvey).length;
                const postCount = course.cohorts.filter((c) => c.hasPostSurvey).length;
                const surveyLabel = [preCount > 0 && `사전 ${preCount}건`, postCount > 0 && `후기 ${postCount}건`].filter(Boolean).join("+") || `${cohortCount}기수`;
                return (
                  <div key={idx} className={`flex items-center gap-2 py-1.5 px-3 rounded-lg border ${isRenamed ? "bg-amber-50 border-amber-300" : isChecked ? "bg-blue-50 border-blue-300" : "bg-muted/50"}`}>
                    {hasMultipleCourses && !isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setMergeSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(idx)) { next.delete(idx); } else { next.add(idx); }
                            return next;
                          });
                          setMergeTarget(null);
                        }}
                        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        title="병합 선택"
                      >
                        {isChecked ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditingCourse((prev) => ({ ...prev, [idx]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") applyCourseRename(idx, editValue);
                            if (e.key === "Escape") setEditingCourse((prev) => { const n = { ...prev }; delete n[idx]; return n; });
                          }}
                          placeholder="강의명"
                          className="flex-1 py-1 px-2 rounded-md border text-[13px] bg-card"
                        />
                        <button
                          onClick={() => applyCourseRename(idx, editValue)}
                          className="py-1 px-2.5 rounded-md bg-primary text-primary-foreground text-[11px] font-bold hover:opacity-90"
                        >
                          적용
                        </button>
                        <button
                          onClick={() => setEditingCourse((prev) => { const n = { ...prev }; delete n[idx]; return n; })}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setEditingCourse((prev) => ({ ...prev, [idx]: course.name }))}
                              className="flex items-center gap-1 text-left cursor-pointer group/row hover:text-primary transition-colors min-w-0"
                              title="클릭하여 강의명 변경"
                            >
                              <span className="text-[13px] font-semibold truncate">
                                {course.name}
                                {isRenamed && <span className="text-[10px] text-amber-600 font-normal ml-1.5">변경됨</span>}
                              </span>
                              <Pencil className="w-3 h-3 text-muted-foreground group-hover/row:text-primary shrink-0 transition-colors" />
                            </button>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">({surveyLabel})</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setMovingPlatformIdx(movingPlatformIdx === idx ? null : idx); }}
                          className="text-muted-foreground hover:text-blue-600 shrink-0 transition-colors"
                          title="플랫폼 이동"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDelCourse(idx); }}
                          className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                          title="강의 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 강의 병합 패널 */}
            {mergeSelected.size >= 2 && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-300">
                <div className="text-[13px] font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                  <Merge className="w-4 h-4" />
                  병합할 이름 선택 ({mergeSelected.size}개 강의)
                </div>
                <div className="space-y-1 mb-3">
                  {Array.from(mergeSelected).map((idx) => (
                    <label key={idx} className="flex items-center gap-2 cursor-pointer py-1 px-2 rounded-md hover:bg-blue-100 transition-colors">
                      <input
                        type="radio"
                        name="merge-target"
                        checked={mergeTarget === idx}
                        onChange={() => setMergeTarget(idx)}
                        className="accent-blue-600"
                      />
                      <span className="text-[13px]">{data.courses[idx]?.name}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setMergeSelected(new Set()); setMergeTarget(null); }}
                    disabled={merging}
                    className="py-1.5 px-4 rounded-md border text-muted-foreground text-[12px] hover:bg-accent disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    disabled={mergeTarget === null || merging}
                    onClick={async () => {
                      if (mergeTarget === null) return;
                      setMerging(true);
                      try {
                        const targetName = data.courses[mergeTarget].name;
                        const toRename = Array.from(mergeSelected).filter((idx) => idx !== mergeTarget);
                        for (const idx of toRename) {
                          const oldName = instructor.courses[idx]?.name ?? data.courses[idx].name;
                          const res = await fetch("/api/rename-course", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              platform: platformName,
                              instructor: instructor.name,
                              oldCourse: oldName,
                              newCourse: targetName,
                            }),
                          });
                          const result = await res.json();
                          if (!res.ok) throw new Error(result.error || "병합 실패");
                        }
                        toast.success(`${toRename.length}개 강의를 '${targetName}'(으)로 병합했습니다`);
                        setMergeSelected(new Set());
                        setMergeTarget(null);
                        await onRefresh();
                        onClose();
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : "병합 실패";
                        toast.error(msg);
                      } finally {
                        setMerging(false);
                      }
                    }}
                    className="py-1.5 px-4 rounded-md bg-blue-600 text-white text-[12px] font-bold flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {merging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    병합하기
                  </button>
                </div>
              </div>
            )}

            {/* 플랫폼 이동 패널 */}
            {movingPlatformIdx !== null && data.courses[movingPlatformIdx] && (
              <div className="mt-2 p-3 bg-indigo-50 rounded-lg border border-indigo-300">
                <div className="text-[13px] font-semibold text-indigo-800 mb-2 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-4 h-4" />
                  &apos;{data.courses[movingPlatformIdx].name}&apos; 플랫폼 이동
                </div>
                <div className="text-[12px] text-muted-foreground mb-2">
                  현재: <span className="font-semibold text-foreground">{platformName}</span> → 이동할 플랫폼:
                </div>
                <div className="flex gap-2 mb-3">
                  {PLATFORMS.filter((p) => p !== platformName).map((p) => (
                    <button
                      key={p}
                      disabled={movingPlatform}
                      onClick={async () => {
                        setMovingPlatform(true);
                        try {
                          const courseName = data.courses[movingPlatformIdx].name;
                          const res = await fetch("/api/move-platform", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              instructor: instructor.name,
                              course: courseName,
                              fromPlatform: platformName,
                              toPlatform: p,
                            }),
                          });
                          const result = await res.json();
                          if (!res.ok) throw new Error(result.error || "이동 실패");
                          toast.success(`'${courseName}' → ${p} 이동 완료 (${result.updated}건)`);
                          setMovingPlatformIdx(null);
                          await onRefresh();
                          onClose();
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : "이동 실패";
                          toast.error(msg);
                        } finally {
                          setMovingPlatform(false);
                        }
                      }}
                      className="py-1.5 px-4 rounded-md bg-indigo-600 text-white text-[12px] font-bold flex items-center gap-1.5 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {movingPlatform && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setMovingPlatformIdx(null)}
                    disabled={movingPlatform}
                    className="py-1.5 px-4 rounded-md border text-muted-foreground text-[12px] hover:bg-accent disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 강의 삭제 확인 */}
            {confirmDelCourse !== null && data.courses[confirmDelCourse] && (
              <div className="mt-2 p-3 bg-red-50 rounded-lg border border-destructive">
                <div className="text-[13px] font-semibold text-destructive mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  &apos;{data.courses[confirmDelCourse].name}&apos; 강의를 삭제합니까?
                </div>
                <div className="text-[12px] text-muted-foreground mb-2.5">
                  모든 기수({data.courses[confirmDelCourse].cohorts.length}개)와 설문 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmDelCourse(null)}
                    disabled={deletingCourse}
                    className="py-1.5 px-4 rounded-md border text-muted-foreground text-[12px] hover:bg-accent disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={async () => {
                      const courseToDelete = data.courses[confirmDelCourse];
                      if (!courseToDelete) return;
                      setDeletingCourse(true);
                      try {
                        await onDeleteCourse(courseToDelete.id, courseToDelete.name);
                        // 로컬 상태에서도 제거
                        setData((prev) => ({
                          ...prev,
                          courses: prev.courses.filter((_, i) => i !== confirmDelCourse),
                        }));
                        setConfirmDelCourse(null);
                      } catch {
                        // error handled by parent
                      } finally {
                        setDeletingCourse(false);
                      }
                    }}
                    disabled={deletingCourse}
                    className="py-1.5 px-4 rounded-md bg-destructive text-destructive-foreground text-[12px] font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {deletingCourse && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cohorts table — grouped by course when multiple */}
        <div className="text-[12px] font-bold text-muted-foreground mb-2.5">기수 정보</div>
        {data.courses.map((course, courseIdx) => (
          <div key={courseIdx} className="mb-4">
            {hasMultipleCourses && (
              <div className="text-[12px] font-bold text-primary mb-1.5 pl-1 flex items-center gap-1">
                📚 {course.name}
                <span className="font-normal text-muted-foreground ml-1">({course.cohorts.length}기수)</span>
              </div>
            )}
            <table className="w-full text-[13px]">
              {courseIdx === 0 && (
                <thead>
                  <tr className="text-muted-foreground text-[11px] font-bold">
                    {["기수", "담당PM", "시작일", "VOD 종료", "수강생", "상태", ""].map((h) => (
                      <th key={h} className="py-1 px-1.5 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {course.cohorts.map((co, ci) => {
                  const status = autoStatus(co);
                  const delKey = `${courseIdx}-${ci}`;
                  return (
                    <tr key={ci}>
                      {(
                        [
                          ["label", 55],
                          ["pm", 75],
                          ["date", 100],
                          ["endDate", 100],
                          ["totalStudents", 60],
                        ] as const
                      ).map(([field, width]) => (
                        <td key={field} className="py-0.5 px-1">
                          <input
                            value={co[field] || ""}
                            onChange={(e) =>
                              updateCohort(
                                courseIdx,
                                ci,
                                field,
                                field === "totalStudents"
                                  ? Number(e.target.value) || 0
                                  : e.target.value
                              )
                            }
                            placeholder={field === "totalStudents" ? "0" : ""}
                            className="py-1 px-2 rounded-md border text-[12px] bg-card"
                            style={{ width }}
                          />
                        </td>
                      ))}
                      <td className="py-0.5 px-1">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${statusBg(status)}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="py-0.5 px-1">
                        <button
                          onClick={() => setConfirmDel(delKey)}
                          className="text-muted-foreground hover:text-destructive"
                          title="기수 삭제"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        <div className="mt-2 py-2 px-3 rounded-lg bg-muted text-[11px] text-muted-foreground leading-relaxed">
          💡 상태 자동 판별:{" "}
          <span className={`text-[10px] px-1 py-0.5 rounded border font-bold ${statusBg("준비중")}`}>
            준비중
          </span>{" "}
          설문 없음 →{" "}
          <span className={`text-[10px] px-1 py-0.5 rounded border font-bold ${statusBg("진행중")}`}>
            진행중
          </span>{" "}
          사전 설문 업로드 →{" "}
          <span className={`text-[10px] px-1 py-0.5 rounded border font-bold ${statusBg("완료")}`}>
            완료
          </span>{" "}
          후기 설문 업로드
        </div>

        {/* Confirm dialog */}
        {confirmDel !== null && (
          <div className="mt-3.5 p-4 bg-red-50 rounded-[10px] border border-destructive">
            <div className="text-[13px] font-semibold text-destructive mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {confirmDel === "inst"
                ? `'${data.name}' 강사의 모든 정보(기수, 설문 데이터)가 삭제됩니다.`
                : `'${getCohortForConfirm(confirmDel)?.label || ""}' 기수의 설문 데이터가 삭제됩니다.`}
            </div>
            <div className="text-[12px] text-muted-foreground mb-3">
              이 작업은 되돌릴 수 없습니다.
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDel(null)}
                className="py-1.5 px-4 rounded-md border text-muted-foreground text-[12px] hover:bg-accent"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (confirmDel === "inst") {
                    onDelete(data.id);
                    onClose();
                  } else {
                    const [ci, coI] = confirmDel.split("-").map(Number);
                    removeCohort(ci, coI);
                  }
                  setConfirmDel(null);
                }}
                className="py-1.5 px-4 rounded-md bg-destructive text-destructive-foreground text-[12px] font-bold"
              >
                삭제
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => setConfirmDel("inst")}
            className="text-muted-foreground text-[11px] underline hover:text-destructive flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            강사 삭제
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="py-2 px-5 rounded-lg border text-muted-foreground text-[13px] hover:bg-accent"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="py-2 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
