"use client";

import { useState, useCallback } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { parseFilename } from "@/lib/filename-parser";
import { X, FileSpreadsheet, Upload, Loader2, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface UploadDialogProps {
  onClose: () => void;
}

interface UploadFileState {
  file: File;
  name: string;
  platform: string;
  inst: string;
  course: string;
  cohort: string;
  type: "사전" | "후기";
  status: "pending" | "uploading" | "done" | "error";
}

export function UploadDialog({ onClose }: UploadDialogProps) {
  const { state, refreshHierarchy } = useAppStore();
  const [files, setFiles] = useState<UploadFileState[]>([]);
  const [step, setStep] = useState<"upload" | "confirm" | "processing">("upload");
  const [overwriteWarning, setOverwriteWarning] = useState<{
    files: { idx: number; name: string; totalComments: number; classifiedComments: number }[];
  } | null>(null);
  const [checking, setChecking] = useState(false);

  const allInstructors = state.platforms.flatMap((p) => p.instructors);
  const allInstNames = [...new Set(allInstructors.map((i) => i.name))];

  const processFileName = useCallback(
    (file: File) => {
      const parsed = parseFilename(file.name, allInstructors);
      return {
        file,
        name: file.name,
        platform: parsed.platform || state.platforms[0]?.name || "핏크닉",
        inst: parsed.instructor,
        course: parsed.course,
        cohort: parsed.cohort,
        type: parsed.type,
        status: "pending" as const,
      };
    },
    [allInstructors, state.platforms]
  );

  const handleFiles = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList)
      .filter((f) => /\.(csv|xlsx?)$/i.test(f.name))
      .map(processFileName);

    if (newFiles.length === 0) {
      toast.error("CSV 또는 XLSX 파일만 업로드 가능합니다");
      return;
    }

    setFiles((prev) => [...prev, ...newFiles]);
    setStep("confirm");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const updateFile = (idx: number, field: keyof UploadFileState, value: string) => {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    if (files.length <= 1) setStep("upload");
  };

  const checkBeforeUpload = async () => {
    setChecking(true);
    const warnings: { idx: number; name: string; totalComments: number; classifiedComments: number }[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.inst || !f.course || !f.cohort) continue;

      try {
        const params = new URLSearchParams({
          platform: f.platform,
          instructor: f.inst,
          course: f.course,
          cohort: f.cohort,
          survey_type: f.type,
        });
        const res = await fetch(`/api/check-classified?${params}`);
        const data = await res.json();
        if (data.exists && data.totalComments > 0) {
          warnings.push({
            idx: i,
            name: f.name,
            totalComments: data.totalComments,
            classifiedComments: data.classifiedComments,
          });
        }
      } catch { /* 체크 실패 시 경고 없이 진행 */ }
    }

    setChecking(false);

    if (warnings.length > 0) {
      setOverwriteWarning({ files: warnings });
    } else {
      processUpload();
    }
  };

  const processUpload = async () => {
    setOverwriteWarning(null);
    setStep("processing");

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.inst || !f.course || !f.cohort) {
        setFiles((prev) =>
          prev.map((file, idx) =>
            idx === i ? { ...file, status: "error" } : file
          )
        );
        const missing = !f.inst ? "강사명" : !f.course ? "강의명" : "기수";
        toast.error(`${f.name}: ${missing} 없음`);
        continue;
      }

      setFiles((prev) =>
        prev.map((file, idx) =>
          idx === i ? { ...file, status: "uploading" } : file
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", f.file);
        formData.append("survey_type", f.type);
        formData.append("platform", f.platform);
        formData.append("instructor", f.inst);
        formData.append("course", f.course);
        formData.append("cohort", f.cohort);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "업로드 실패");
        }

        const data = await res.json();

        setFiles((prev) =>
          prev.map((file, idx) =>
            idx === i ? { ...file, status: "done" } : file
          )
        );

        const msgs: string[] = [`${data.responseCount}명 업로드 완료`];
        if (data.replaced) msgs.push("(기존 데이터 교체)");
        toast.success(`${f.name}: ${msgs.join(" · ")}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "업로드 실패";
        console.error(`[Upload] ${f.name} 실패:`, err);
        setFiles((prev) =>
          prev.map((file, idx) =>
            idx === i ? { ...file, status: "error" } : file
          )
        );
        toast.error(`${f.name}: ${msg}`);
      }
    }

    // 업로드 완료 후 계층 새로고침 (캐시 무시)
    await refreshHierarchy(true);
  };

  const allDone = files.every((f) => f.status === "done" || f.status === "error");
  const hasInvalid = files.some((f) => !f.inst || !f.course || !f.cohort);

  return (
    <div
      className="fixed inset-0 bg-black/20 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-[14px] p-7 shadow-xl border max-h-[80vh] overflow-y-auto"
        style={{ width: step === "upload" ? 460 : 720 }}
      >
        <div className="flex justify-between items-center mb-1.5">
          <h3 className="text-[17px] font-extrabold">설문 데이터 업로드</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-muted-foreground text-[13px] mb-4">
          네이버폼/타입폼 CSV, XLSX · 여러 파일 동시 업로드 가능
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-[10px] text-center cursor-pointer mb-3.5 relative transition-colors ${
            files.length > 0
              ? "border-primary bg-primary/5 p-4"
              : "border-border p-7 hover:border-primary/50"
          }`}
        >
          {files.length === 0 ? (
            <>
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <div className="text-[13px] font-semibold">파일 드래그 또는 클릭</div>
              <div className="text-[12px] text-muted-foreground">
                여러 파일 선택 가능 · 최대 10MB
              </div>
            </>
          ) : (
            <div className="text-[13px] text-primary font-semibold">
              {files.length}개 파일 선택됨 · 파일 추가하려면 클릭
            </div>
          )}
          <input
            type="file"
            multiple
            accept=".csv,.xlsx,.xls"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>

        {/* Confirm step */}
        {step === "confirm" && files.length > 0 && (
          <div>
            <div className="text-[12px] font-bold text-muted-foreground mb-2">
              AI 자동 인식 결과 — 틀리면 직접 수정해주세요
            </div>
            {files.map((f, i) => {
              const hasInst = !!f.inst;
              const hasCourse = !!f.course;
              const hasCohort = !!f.cohort;
              return (
                <div key={i} className="p-3.5 bg-muted rounded-[10px] mb-2 border">
                  <div className="flex justify-between items-center mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span className="text-[13px] font-semibold truncate max-w-[280px]">
                        {f.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground text-[12px] hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                        플랫폼
                      </label>
                      <select
                        value={f.platform}
                        onChange={(e) => updateFile(i, "platform", e.target.value)}
                        className="w-full py-1.5 px-2 rounded-md border text-[12px] bg-card"
                      >
                        {state.platforms.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                        강사
                      </label>
                      <input
                        value={f.inst}
                        onChange={(e) => updateFile(i, "inst", e.target.value)}
                        placeholder="강사명"
                        list={`inst-list-${i}`}
                        className={`w-full py-1.5 px-2 rounded-md border text-[12px] bg-card ${
                          hasInst ? "border-emerald-500" : "border-amber-500"
                        }`}
                      />
                      <datalist id={`inst-list-${i}`}>
                        {allInstNames.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                        강의명
                      </label>
                      <input
                        value={f.course}
                        onChange={(e) => updateFile(i, "course", e.target.value)}
                        placeholder="강의명 필수"
                        className={`w-full py-1.5 px-2 rounded-md border text-[12px] bg-card ${
                          hasCourse ? "border-emerald-500" : "border-amber-500"
                        }`}
                      />
                      {!hasCourse && (
                        <div className="text-[10px] text-amber-600 mt-0.5">강의명을 입력하세요</div>
                      )}
                      {(() => {
                        const matchPlatform = state.platforms.find((p) => p.name === f.platform);
                        const matchInst = matchPlatform?.instructors.find((ins) => ins.name === f.inst);
                        const existingCourses = matchInst?.courses
                          .map((c) => c.name)
                          .filter((name) => name && name !== f.course) ?? [];
                        if (existingCourses.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="text-[10px] text-muted-foreground leading-[22px]">기존:</span>
                            {existingCourses.map((name) => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => updateFile(i, "course", name)}
                                className="text-[10px] px-1.5 py-0.5 rounded-md border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors truncate max-w-[140px]"
                                title={name}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                        기수
                      </label>
                      <input
                        value={f.cohort}
                        onChange={(e) => updateFile(i, "cohort", e.target.value)}
                        placeholder="예: 1기"
                        className={`w-full py-1.5 px-2 rounded-md border text-[12px] bg-card ${
                          hasCohort ? "border-emerald-500" : "border-amber-500"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">
                        유형
                      </label>
                      <select
                        value={f.type}
                        onChange={(e) => updateFile(i, "type", e.target.value as "사전" | "후기")}
                        className="w-full py-1.5 px-2 rounded-md border border-emerald-500 text-[12px] bg-card"
                      >
                        <option value="사전">사전</option>
                        <option value="후기">후기</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2 mt-3.5">
              <button
                onClick={() => {
                  setStep("upload");
                  setFiles([]);
                }}
                className="flex-1 py-2.5 rounded-lg border text-muted-foreground text-[13px] hover:bg-accent transition-colors"
              >
                초기화
              </button>
              <button
                onClick={checkBeforeUpload}
                disabled={hasInvalid || checking}
                className="flex-[2] py-2.5 rounded-lg bg-primary text-primary-foreground text-[14px] font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {checking ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    기존 데이터 확인 중...
                  </span>
                ) : (
                  `확인 후 업로드 (${files.length}개)`
                )}
              </button>
            </div>
          </div>
        )}

        {/* Processing step */}
        {step === "processing" && (
          <div>
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-2 border-b last:border-0"
              >
                {f.status === "uploading" && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                )}
                {f.status === "done" && (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                )}
                {f.status === "error" && (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                )}
                {f.status === "pending" && (
                  <div className="w-4 h-4 rounded-full border-2 border-muted" />
                )}
                <span className="text-[13px] flex-1 truncate">{f.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {f.inst}{f.course ? ` · ${f.course}` : ""} · {f.cohort} · {f.type}
                </span>
              </div>
            ))}
            {allDone && (
              <button
                onClick={onClose}
                className="w-full mt-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-[14px] font-bold hover:opacity-90 transition-opacity"
              >
                완료
              </button>
            )}
          </div>
        )}

        {/* Overwrite warning modal */}
        {overwriteWarning && (
          <div className="fixed inset-0 bg-black/40 z-[210] flex items-center justify-center" onClick={() => setOverwriteWarning(null)}>
            <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-[14px] p-6 shadow-xl border max-w-[440px] w-full">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-full bg-amber-100 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h4 className="text-[15px] font-extrabold text-amber-800">기존 분류 데이터가 삭제됩니다</h4>
                  <p className="text-[12px] text-muted-foreground mt-1">
                    아래 파일의 기존 설문 데이터가 이미 존재합니다. 업로드하면 기존 댓글과 분류 작업이 모두 초기화됩니다.
                  </p>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                {overwriteWarning.files.map((w) => (
                  <div key={w.idx} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-[13px] font-semibold truncate">{w.name}</div>
                    <div className="text-[12px] text-amber-700 mt-1">
                      기존 댓글 {w.totalComments}건
                      {w.classifiedComments > 0 && (
                        <span className="font-bold text-red-600"> (분류 완료 {w.classifiedComments}건 삭제됨)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setOverwriteWarning(null)}
                  className="flex-1 py-2.5 rounded-lg border text-[13px] text-muted-foreground hover:bg-accent transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={processUpload}
                  className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-[13px] font-bold hover:bg-red-700 transition-colors"
                >
                  삭제하고 재업로드
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {step === "upload" && files.length === 0 && (
          <div className="py-2.5 px-3.5 rounded-lg bg-primary/5 text-[12px] text-primary">
            파일명에 강사명/기수가 포함되어 있으면 AI가 자동으로 인식합니다.
            <br />
            예: &quot;민대표_1기_사전설문.xlsx&quot; → 민대표 · 1기 · 사전
          </div>
        )}
      </div>
    </div>
  );
}
