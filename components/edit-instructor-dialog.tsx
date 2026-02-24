"use client";

import { useState } from "react";
import type { Instructor, Cohort } from "@/lib/types";
import { autoStatus, statusBg } from "@/lib/types";
import { X, User, Trash2, AlertTriangle } from "lucide-react";

interface EditInstructorDialogProps {
  instructor: Instructor;
  onSave: (updated: Instructor) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function EditInstructorDialog({
  instructor,
  onSave,
  onDelete,
  onClose,
}: EditInstructorDialogProps) {
  const [data, setData] = useState<Instructor>(JSON.parse(JSON.stringify(instructor)));
  const [confirmDel, setConfirmDel] = useState<null | "inst" | number>(null);

  const updateCohort = (ci: number, field: keyof Cohort, value: string | number) => {
    setData((prev) => ({
      ...prev,
      cohorts: prev.cohorts.map((c, i) => (i === ci ? { ...c, [field]: value } : c)),
    }));
  };

  const removeCohort = (ci: number) => {
    setData((prev) => ({
      ...prev,
      cohorts: prev.cohorts.filter((_, i) => i !== ci),
    }));
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
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", 0.85);
      setData((prev) => ({ ...prev, photo: compressed }));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      // fallback: 압축 실패 시 원본 base64
      const reader = new FileReader();
      reader.onload = (ev) => {
        setData((prev) => ({ ...prev, photo: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // Parse photoPosition to get vertical percentage (0-100)
  const getVerticalPosition = (): number => {
    const pos = data.photoPosition || "center center";
    const parts = pos.split(" ");
    const yPart = parts[1] || "50%";
    return parseInt(yPart) || 50;
  };

  const setVerticalPosition = (value: number) => {
    setData((prev) => ({ ...prev, photoPosition: `center ${value}%` }));
  };

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
                    style={{ objectPosition: data.photoPosition || "center center" }}
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
            <label className="text-[11px] text-muted-foreground font-bold block mb-1">강의명</label>
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

        {/* Cohorts table */}
        <div className="text-[12px] font-bold text-muted-foreground mb-2.5">기수 정보</div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-muted-foreground text-[11px] font-bold">
              {["기수", "담당PM", "시작일", "종료일", "수강생", "상태", ""].map((h) => (
                <th key={h} className="py-1 px-1.5 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.cohorts.map((co, ci) => {
              const status = autoStatus(co);
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
                      onClick={() => setConfirmDel(ci)}
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
                : `'${data.cohorts[confirmDel as number]?.label || ""}' 기수의 설문 데이터가 삭제됩니다.`}
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
                    removeCohort(confirmDel as number);
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
              onClick={() => {
                onSave(data);
                onClose();
              }}
              className="py-2 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
