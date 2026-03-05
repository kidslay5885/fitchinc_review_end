"use client";

import { useState, useRef, useCallback } from "react";
import type { SurveyForm, FormField } from "@/lib/types";
import { Loader2, CheckCircle2, ChevronDown, ImagePlus, X, Upload } from "lucide-react";

interface Props {
  form: SurveyForm;
}

const SECTION_LABELS: Record<string, string> = {
  demographics: "기본 정보",
  scores: "만족도 평가",
  freetext: "자유 의견",
};

const SECTION_ORDER = ["demographics", "scores", "freetext"];

// ===== 척도 입력 =====

function ScaleInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  const min = field.scaleMin ?? 1;
  const max = field.scaleMax ?? 5;
  const points = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="flex flex-col gap-1.5">
      {/* 라벨 행 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-gray-400">{min}점</span>
        <span className="text-[11px] text-gray-400">{max}점</span>
      </div>
      {/* 버튼 행: 균등 배분 */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${points.length}, 1fr)` }}>
        {points.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(String(p))}
            className={`aspect-square min-h-[48px] rounded-2xl border-2 text-[15px] font-bold transition-all active:scale-95 ${
              value === String(p)
                ? "border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-200"
                : "border-gray-200 bg-white text-gray-500 active:bg-blue-50 active:border-blue-300"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ===== 이미지 업로드 필드 =====

function ImageUploadField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("JPG, PNG, WebP 형식만 업로드 가능합니다");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("이미지는 5MB 이하만 업로드 가능합니다");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/survey-images", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        onChange(data.url);
      } else {
        alert(data.error || "업로드에 실패했습니다");
      }
    } catch {
      alert("업로드 중 오류가 발생했습니다");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (value) {
    return (
      <div className="relative inline-block">
        <img
          src={value}
          alt="업로드된 이미지"
          className="max-w-full max-h-60 rounded-2xl border-2 border-gray-200 object-contain"
        />
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center shadow hover:bg-black/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-3 py-8 px-4 rounded-2xl border-2 border-dashed transition-all ${
        error ? "border-red-300 bg-red-50/50" :
        dragOver ? "border-blue-400 bg-blue-50" :
        "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50"
      }`}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />

      {uploading ? (
        <>
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-[14px] text-gray-500">업로드 중...</span>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
            <ImagePlus className="w-7 h-7 text-blue-500" />
          </div>
          <div className="text-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-[15px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              사진 선택
            </button>
            <p className="text-[12px] text-gray-400 mt-1">
              또는 여기에 드래그 &amp; 드롭 (최대 5MB)
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ===== 필드 렌더러 =====

function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  // 16px 이상으로 iOS 자동 줌 방지
  const baseInput =
    "w-full py-3 px-4 rounded-2xl border-2 text-[16px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all appearance-none";
  const errorCls = error ? "border-red-300 ring-2 ring-red-200" : "border-gray-200";

  switch (field.type) {
    case "text":
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "입력해주세요"}
          className={`${baseInput} ${errorCls}`}
          autoComplete="off"
        />
      );

    case "number":
      return (
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "숫자를 입력해주세요"}
          className={`${baseInput} ${errorCls}`}
        />
      );

    case "textarea":
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "자유롭게 작성해주세요"}
          rows={4}
          className={`${baseInput} resize-none min-h-[120px] ${errorCls}`}
        />
      );

    case "select":
      return (
        <div className="relative">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${baseInput} pr-10 ${errorCls} ${!value ? "text-gray-400" : "text-gray-800"}`}
          >
            <option value="">선택해주세요</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
      );

    case "radio":
      return (
        <div className="flex flex-col gap-2">
          {(field.options || []).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex items-center gap-3 py-3.5 px-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                value === opt
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-gray-200 bg-white active:bg-gray-50"
              }`}
            >
              {/* 라디오 원 */}
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  value === opt ? "border-blue-500" : "border-gray-300"
                }`}
              >
                {value === opt && (
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                )}
              </span>
              <span
                className={`text-[15px] ${
                  value === opt ? "text-blue-700 font-semibold" : "text-gray-600"
                }`}
              >
                {opt}
              </span>
            </button>
          ))}
        </div>
      );

    case "scale":
      return <ScaleInput field={field} value={value} onChange={onChange} />;

    case "image":
      return <ImageUploadField value={value} onChange={onChange} error={error} />;

    default:
      return null;
  }
}

// ===== 진행률 바 =====

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ===== 메인 컴포넌트 =====

export function SurveyFormPublic({ form }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const enabledFields = (form.fields as FormField[])
    .filter((f) => f.enabled)
    .sort((a, b) => a.order - b.order);

  // 섹션별 그룹핑
  const sections = SECTION_ORDER
    .map((sec) => ({
      key: sec,
      label: SECTION_LABELS[sec],
      fields: enabledFields.filter((f) => f.section === sec),
    }))
    .filter((s) => s.fields.length > 0);

  const unsectioned = enabledFields.filter((f) => !f.section);
  if (unsectioned.length > 0) {
    sections.push({ key: "other", label: "기타", fields: unsectioned });
  }

  // 진행률 계산
  const totalRequired = enabledFields.filter((f) => f.required).length;
  const answeredRequired = enabledFields.filter(
    (f) => f.required && (answers[f.key] || "").trim()
  ).length;

  const handleChange = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (errors.has(key)) {
      setErrors((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleSubmit = async () => {
    const newErrors = new Set<string>();
    for (const f of enabledFields) {
      if (f.required && !(answers[f.key] || "").trim()) {
        newErrors.add(f.key);
      }
    }

    if (newErrors.size > 0) {
      setErrors(newErrors);
      const firstErrorKey = enabledFields.find((f) => newErrors.has(f.key))?.key;
      if (firstErrorKey) {
        document.getElementById(`field-${firstErrorKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/survey-forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: form.token, answers }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "제출에 실패했습니다");
        return;
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      alert("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 기간 체크 =====
  const now = new Date();
  const notStarted = form.starts_at && new Date(form.starts_at) > now;
  const expired = form.expires_at && new Date(form.expires_at) < now;

  if (notStarted) {
    const startDate = new Date(form.starts_at!).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-6">
        <div className="bg-white rounded-3xl shadow-lg border p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">📅</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">아직 설문 기간이 아닙니다</h1>
          <p className="text-[15px] text-gray-500 leading-relaxed">
            {startDate}부터 응답 가능합니다.
          </p>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-6">
        <div className="bg-white rounded-3xl shadow-lg border p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">⏰</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">설문이 마감되었습니다</h1>
          <p className="text-[15px] text-gray-500 leading-relaxed">
            응답 기간이 종료되었습니다.<br />감사합니다.
          </p>
        </div>
      </div>
    );
  }

  // ===== 제출 완료 =====
  if (submitted) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-blue-50 to-white p-6 pb-safe">
        <div className="bg-white rounded-3xl shadow-lg border p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">감사합니다!</h1>
          <p className="text-[15px] text-gray-500 leading-relaxed">
            설문 응답이<br />성공적으로 제출되었습니다.
          </p>
          <p className="text-[13px] text-gray-400 mt-6">이 페이지를 닫으셔도 됩니다.</p>
        </div>
      </div>
    );
  }

  // ===== 설문 폼 =====
  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* 상단 고정 헤더 + 진행률 */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-100 safe-top">
        <div className="max-w-lg mx-auto px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-bold text-gray-700 truncate">
              {form.title || `${form.instructor} ${form.survey_type} 설문`}
            </span>
            {totalRequired > 0 && (
              <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                {answeredRequired}/{totalRequired}
              </span>
            )}
          </div>
          {totalRequired > 0 && (
            <ProgressBar current={answeredRequired} total={totalRequired} />
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 sm:px-5 pt-5 pb-28" ref={formRef}>
        {/* 설문 정보 카드 */}
        <div className="bg-white rounded-3xl shadow-sm border p-5 sm:p-6 mb-5">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-[12px] px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-semibold">
              {form.platform}
            </span>
            <span className="text-[12px] text-gray-400">
              {form.instructor} {form.cohort && `· ${form.cohort}`}
            </span>
          </div>
          <h1 className="text-[17px] sm:text-lg font-bold text-gray-800 mt-1">
            {form.title || `${form.instructor} ${form.survey_type} 설문`}
          </h1>
          {form.description && (
            <p className="text-[14px] text-gray-500 mt-2 leading-relaxed">{form.description}</p>
          )}
        </div>

        {/* 섹션별 질문 */}
        {sections.map((section) => (
          <div key={section.key} className="bg-white rounded-3xl shadow-sm border p-5 sm:p-6 mb-4">
            <h2 className="text-[14px] font-bold text-gray-700 mb-5 flex items-center gap-2.5">
              <span className="w-1.5 h-5 bg-blue-500 rounded-full" />
              {section.label}
            </h2>

            <div className="space-y-7">
              {section.fields.map((field) => (
                <div key={field.key} id={`field-${field.key}`}>
                  <label className="block text-[15px] font-semibold text-gray-700 mb-2.5 leading-snug">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {field.descriptionImage && (
                    <img
                      src={field.descriptionImage}
                      alt="설명 이미지"
                      className="max-w-full max-h-48 rounded-xl border border-gray-200 object-contain mb-3"
                    />
                  )}
                  <FieldRenderer
                    field={field}
                    value={answers[field.key] || ""}
                    onChange={(v) => handleChange(field.key, v)}
                    error={errors.has(field.key)}
                  />
                  {errors.has(field.key) && (
                    <p className="text-[13px] text-red-500 mt-2 flex items-center gap-1">
                      <span className="inline-block w-1 h-1 rounded-full bg-red-500" />
                      필수 항목입니다
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 마지막 안내 메시지 */}
        <div className="bg-white rounded-3xl shadow-sm border p-5 sm:p-6">
          <p className="text-[14px] text-gray-500">설문에 참여해 주셔서 감사합니다.</p>
        </div>
      </div>

      {/* 하단 고정 제출 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-gray-200 safe-bottom">
        <div className="max-w-lg mx-auto px-4 sm:px-5 py-3">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-[16px] hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-all shadow-lg shadow-blue-200/50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                제출 중...
              </>
            ) : (
              "제출하기"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
