"use client";

import { useState, useCallback, useRef } from "react";
import type { FormField, SurveyForm } from "@/lib/types";
import { PRE_SURVEY_DEFAULTS, POST_SURVEY_DEFAULTS } from "@/lib/form-utils";
import { PLATFORM_NAMES } from "@/lib/constants";
import {
  Plus,
  Copy,
  Check,
  Loader2,
  X,
  GripVertical,
  Trash2,
  Copy as CopyIcon,
  ChevronDown,
  Star,
  AlignLeft,
  ListChecks,
  CircleDot,
  Type,
  Hash,
  Calendar,
  ArrowLeft,
  ImagePlus,
  Upload,
} from "lucide-react";

// ===== 질문 유형 정의 =====

const FIELD_TYPES = [
  { value: "radio" as const, label: "객관식", icon: <CircleDot className="w-4 h-4" />, desc: "하나만 선택" },
  { value: "select" as const, label: "객관식 (드롭다운)", icon: <ListChecks className="w-4 h-4" />, desc: "드롭다운 선택" },
  { value: "text" as const, label: "주관식 단답형", icon: <Type className="w-4 h-4" />, desc: "짧은 텍스트" },
  { value: "textarea" as const, label: "주관식 서술형", icon: <AlignLeft className="w-4 h-4" />, desc: "긴 텍스트" },
  { value: "scale" as const, label: "척도형", icon: <Star className="w-4 h-4" />, desc: "점수 선택" },
  { value: "number" as const, label: "숫자", icon: <Hash className="w-4 h-4" />, desc: "숫자 입력" },
  { value: "image" as const, label: "이미지 업로드", icon: <ImagePlus className="w-4 h-4" />, desc: "사진 첨부" },
] as const;

function getTypeLabel(type: string) {
  return FIELD_TYPES.find((t) => t.value === type)?.label || type;
}
function getTypeIcon(type: string) {
  return FIELD_TYPES.find((t) => t.value === type)?.icon || <Type className="w-4 h-4" />;
}

// ===== 질문 카드 컴포넌트 =====

function QuestionCard({
  field,
  index,
  total,
  onUpdate,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  isDragging,
  isDragOver,
}: {
  field: FormField;
  index: number;
  total: number;
  onUpdate: (updates: Partial<FormField>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  isDragOver: boolean;
}) {
  const [typeOpen, setTypeOpen] = useState(false);
  const hasOptions = field.type === "radio" || field.type === "select";
  const handleRef = useRef<HTMLDivElement>(null);
  const descImgRef = useRef<HTMLInputElement>(null);
  const [uploadingDescImg, setUploadingDescImg] = useState(false);

  const addOption = () => {
    const current = field.options || [];
    onUpdate({ options: [...current, `항목 ${current.length + 1}`] });
  };

  const updateOption = (idx: number, value: string) => {
    const current = [...(field.options || [])];
    current[idx] = value;
    onUpdate({ options: current });
  };

  const removeOption = (idx: number) => {
    const current = [...(field.options || [])];
    current.splice(idx, 1);
    onUpdate({ options: current });
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        // 드래그 핸들에서만 드래그 시작
        if (!handleRef.current?.contains(e.target as Node)) {
          e.preventDefault();
          return;
        }
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={`bg-card rounded-xl border-2 transition-all shadow-sm ${
        isDragging ? "opacity-40 scale-[0.98] border-primary/40" :
        isDragOver ? "border-primary border-dashed shadow-md" :
        "border-border hover:border-primary/20"
      }`}
    >
      {/* 상단: 드래그 핸들 + 타입 드롭다운 */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {/* 드래그 핸들 */}
        <div
          ref={handleRef}
          className="flex flex-col items-center justify-center w-6 h-10 cursor-grab active:cursor-grabbing rounded hover:bg-accent transition-colors flex-shrink-0 -ml-1"
          title="드래그하여 순서 변경"
        >
          <GripVertical className="w-5 h-5 text-muted-foreground/50" />
        </div>

        {/* 타입 선택 드롭다운 */}
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => setTypeOpen(!typeOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background hover:bg-accent text-[13px] font-semibold transition-colors whitespace-nowrap"
          >
            {getTypeIcon(field.type)}
            {getTypeLabel(field.type)}
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${typeOpen ? "rotate-180" : ""}`} />
          </button>

          {typeOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setTypeOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 bg-card rounded-xl border shadow-xl py-1 w-[260px]">
                {FIELD_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      const updates: Partial<FormField> = { type: t.value };
                      // 타입 변경 시 옵션 초기화
                      if ((t.value === "radio" || t.value === "select") && !field.options?.length) {
                        updates.options = ["항목 1", "항목 2"];
                      }
                      if (t.value === "scale") {
                        updates.scaleMin = field.scaleMin ?? 1;
                        updates.scaleMax = field.scaleMax ?? 5;
                      }
                      onUpdate(updates);
                      setTypeOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-accent transition-colors whitespace-nowrap ${
                      field.type === t.value ? "text-primary font-bold bg-primary/5" : "text-foreground"
                    }`}
                  >
                    <span className="text-muted-foreground">{t.icon}</span>
                    <span>{t.label}</span>
                    <span className="text-[11px] text-muted-foreground ml-auto">{t.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

      </div>

      {/* 질문 입력 */}
      <div className="px-4 pb-2">
        <div className="flex items-start gap-1 mb-1">
          {field.required && <span className="text-red-500 text-[14px] font-bold mt-0.5">*</span>}
          <span className="text-[13px] text-emerald-600 font-bold mt-0.5">{index + 1}.</span>
        </div>
        <input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="질문 입력"
          className="w-full text-[15px] font-semibold bg-transparent outline-none border-b-2 border-transparent focus:border-primary/30 py-1.5 transition-colors"
        />
        <input
          value={field.placeholder || ""}
          onChange={(e) => onUpdate({ placeholder: e.target.value })}
          placeholder="설명 입력 (선택)"
          className="w-full text-[12px] text-muted-foreground bg-transparent outline-none py-1 mt-0.5"
        />

        {/* 설명 이미지 첨부 */}
        <div className="mt-2">
          {field.descriptionImage ? (
            <div className="relative inline-block">
              <img
                src={field.descriptionImage}
                alt="설명 이미지"
                className="max-h-32 rounded-lg border object-cover"
              />
              <button
                type="button"
                onClick={() => onUpdate({ descriptionImage: undefined })}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <>
              <input
                ref={descImgRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    alert("이미지는 5MB 이하만 업로드 가능합니다");
                    return;
                  }
                  setUploadingDescImg(true);
                  try {
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/api/survey-images", { method: "POST", body: fd });
                    const data = await res.json();
                    if (res.ok && data.url) {
                      onUpdate({ descriptionImage: data.url });
                    } else {
                      alert(data.error || "업로드 실패");
                    }
                  } catch {
                    alert("업로드 중 오류가 발생했습니다");
                  } finally {
                    setUploadingDescImg(false);
                    if (descImgRef.current) descImgRef.current.value = "";
                  }
                }}
              />
              <button
                type="button"
                onClick={() => descImgRef.current?.click()}
                disabled={uploadingDescImg}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {uploadingDescImg ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                설명 이미지 첨부
              </button>
            </>
          )}
        </div>
      </div>

      {/* 이미지 업로드 타입 안내 */}
      {field.type === "image" && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-blue-50 border border-blue-200 text-[12px] text-blue-700">
            <ImagePlus className="w-4 h-4 flex-shrink-0" />
            응답자가 이미지(사진/스크린샷)를 업로드할 수 있습니다. (최대 5MB, JPG/PNG/WebP)
          </div>
        </div>
      )}

      {/* 옵션 목록 (객관식) */}
      {hasOptions && (
        <div className="px-4 pb-2">
          <div className="space-y-1.5">
            {(field.options || []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <GripVertical className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                <div className="flex-1 flex items-center border-b border-border">
                  <input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`항목 ${i + 1}`}
                    className="flex-1 py-2 text-[13px] bg-transparent outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                    title="항목 삭제"
                  >
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={addOption}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[12px] font-bold hover:bg-emerald-100 transition-colors border border-emerald-200"
            >
              항목 추가
            </button>
          </div>
        </div>
      )}

      {/* 척도 설정 */}
      {field.type === "scale" && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-3 text-[13px]">
            <label className="flex items-center gap-1.5 text-muted-foreground">
              최소
              <input
                type="number"
                value={field.scaleMin ?? 1}
                onChange={(e) => onUpdate({ scaleMin: parseInt(e.target.value) || 1 })}
                className="w-14 py-1.5 px-2 rounded-lg border text-[13px] bg-background text-center"
              />
            </label>
            <span className="text-muted-foreground">~</span>
            <label className="flex items-center gap-1.5 text-muted-foreground">
              최대
              <input
                type="number"
                value={field.scaleMax ?? 5}
                onChange={(e) => onUpdate({ scaleMax: parseInt(e.target.value) || 5 })}
                className="w-14 py-1.5 px-2 rounded-lg border text-[13px] bg-background text-center"
              />
            </label>
            <span className="text-muted-foreground text-[12px]">점</span>
          </div>
        </div>
      )}

      {/* 하단: 필수 토글 + 액션 버튼 */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 mt-1">
        <div className="flex items-center gap-4">
          {/* 답변 필수 토글 */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[12px] font-semibold text-muted-foreground">답변 필수</span>
            <button
              type="button"
              onClick={() => onUpdate({ required: !field.required })}
              className={`w-10 h-[22px] rounded-full relative transition-colors ${
                field.required ? "bg-emerald-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  field.required ? "left-[22px]" : "left-[3px]"
                }`}
              />
            </button>
          </label>

          {/* 활성/비활성 토글 */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-[12px] font-semibold text-muted-foreground">표시</span>
            <button
              type="button"
              onClick={() => onUpdate({ enabled: !field.enabled })}
              className={`w-10 h-[22px] rounded-full relative transition-colors ${
                field.enabled ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  field.enabled ? "left-[22px]" : "left-[3px]"
                }`}
              />
            </button>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicate}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="복제"
          >
            <CopyIcon className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-50 transition-colors"
            title="삭제"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 메인 빌더 =====

interface Props {
  editForm?: SurveyForm | null;
  onSaved: (form: SurveyForm) => void;
  onCancel: () => void;
}

/** 오늘 날짜를 YYYY-MM-DD 형식으로 */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
/** 오늘 + N일 */
function futureDateStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SurveyFormBuilder({ editForm, onSaved, onCancel }: Props) {
  const isEditing = !!editForm;

  const [platform, setPlatform] = useState(editForm?.platform || PLATFORM_NAMES[0]);
  const [instructor, setInstructor] = useState(editForm?.instructor || "");
  const [course, setCourse] = useState(editForm?.course || "");
  const [cohort, setCohort] = useState(editForm?.cohort || "");
  const [surveyType, setSurveyType] = useState<"사전" | "후기">(editForm?.survey_type || "후기");
  const [title, setTitle] = useState(editForm?.title || "");
  const [description, setDescription] = useState(editForm?.description || "");
  const [startsAt, setStartsAt] = useState(editForm?.starts_at?.slice(0, 10) || todayStr());
  const [expiresAt, setExpiresAt] = useState(editForm?.expires_at?.slice(0, 10) || futureDateStr(14));
  const [fields, setFields] = useState<FormField[]>(
    editForm?.fields?.length ? (editForm.fields as FormField[]) : POST_SURVEY_DEFAULTS.map((f) => ({ ...f }))
  );

  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 드래그 상태
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const handleTypeChange = useCallback(
    (type: "사전" | "후기") => {
      setSurveyType(type);
      if (!isEditing) {
        setFields(
          (type === "사전" ? PRE_SURVEY_DEFAULTS : POST_SURVEY_DEFAULTS).map((f) => ({ ...f }))
        );
      }
    },
    [isEditing]
  );

  const updateField = (key: string, updates: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, ...updates } : f))
    );
  };

  const handleDrop = useCallback((fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setFields((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const fromIdx = sorted.findIndex((f) => f.key === fromKey);
      const toIdx = sorted.findIndex((f) => f.key === toKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      // 아이템을 빼서 목표 위치에 삽입
      const [moved] = sorted.splice(fromIdx, 1);
      sorted.splice(toIdx, 0, moved);
      // order 재할당
      return sorted.map((f, i) => ({ ...f, order: i + 1 }));
    });
    setDraggedKey(null);
    setDragOverKey(null);
  }, []);

  const duplicateField = (key: string) => {
    setFields((prev) => {
      const source = prev.find((f) => f.key === key);
      if (!source) return prev;
      const id = Date.now().toString(36);
      const maxOrder = Math.max(0, ...prev.map((f) => f.order));
      return [
        ...prev,
        {
          ...source,
          key: `custom_${id}`,
          label: `${source.label} (복사)`,
          order: maxOrder + 1,
          options: source.options ? [...source.options] : undefined,
        },
      ];
    });
  };

  const deleteField = (key: string) => {
    setFields((prev) => prev.filter((f) => f.key !== key));
  };

  const addQuestion = () => {
    const id = Date.now().toString(36);
    const maxOrder = Math.max(0, ...fields.map((f) => f.order));
    setFields((prev) => [
      ...prev,
      {
        key: `custom_${id}`,
        label: "",
        type: "textarea",
        required: false,
        enabled: true,
        order: maxOrder + 1,
        section: "freetext",
        placeholder: "",
      },
    ]);
  };

  const handleSave = async () => {
    if (!instructor.trim()) {
      alert("강사명을 입력해주세요");
      return;
    }

    const enabledFields = fields.filter((f) => f.enabled);
    if (enabledFields.length === 0) {
      alert("최소 1개의 활성 질문이 필요합니다");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(isEditing ? { id: editForm!.id } : {}),
        platform,
        instructor: instructor.trim(),
        course: course.trim(),
        cohort: cohort.trim(),
        survey_type: surveyType,
        title: title.trim() || `${instructor.trim()} ${cohort.trim()} ${surveyType} 설문`,
        description: description.trim(),
        fields,
        starts_at: startsAt ? `${startsAt}T00:00:00.000Z` : null,
        expires_at: expiresAt ? `${expiresAt}T23:59:59.999Z` : null,
      };

      const res = await fetch("/api/survey-forms", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "저장 실패");
        return;
      }

      const form = data.form as SurveyForm;
      onSaved(form);

      if (!isEditing) {
        const url = `${window.location.origin}/survey/${form.token}`;
        setSavedUrl(url);
      }
    } catch {
      alert("저장 중 오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (!savedUrl) return;
    navigator.clipboard.writeText(savedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  // 저장 완료 + URL 표시
  if (savedUrl) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-card rounded-xl border p-6 text-center">
          <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-[16px] font-bold mb-2">설문 폼이 생성되었습니다!</h2>
          <p className="text-[13px] text-muted-foreground mb-4">
            아래 URL을 수강생에게 공유하세요.
          </p>
          <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
            <input
              readOnly
              value={savedUrl}
              className="flex-1 bg-transparent text-[13px] outline-none"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[12px] font-bold hover:opacity-90 transition-opacity"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <button
            onClick={onCancel}
            className="mt-4 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="목록으로 돌아가기"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-[16px] font-bold">
            {isEditing ? "설문 폼 수정" : "새 설문 폼 만들기"}
          </h2>
        </div>
        <button
          onClick={onCancel}
          className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          취소
        </button>
      </div>

      {/* 메타데이터 */}
      <div className="bg-card rounded-xl border p-5 mb-4 space-y-4">
        <h3 className="text-[14px] font-bold">기본 정보</h3>
        <hr className="border-border/60" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground mb-1 block">플랫폼</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full py-2 px-3 rounded-lg border text-[13px] bg-background"
            >
              {PLATFORM_NAMES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground mb-1 block">강사명 *</label>
            <input
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="예: 머니테이커"
              className="w-full py-2 px-3 rounded-lg border text-[13px] bg-background"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground mb-1 block">강의명</label>
            <input
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="예: 파이널VIP 코스"
              className="w-full py-2 px-3 rounded-lg border text-[13px] bg-background"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground mb-1 block">기수</label>
            <input
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              placeholder="예: 21기"
              className="w-full py-2 px-3 rounded-lg border text-[13px] bg-background"
            />
          </div>
        </div>

        <hr className="border-border/60" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground mb-1 block">설문 유형</label>
            <div className="flex gap-2">
              {(["사전", "후기"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`flex-1 py-2 rounded-lg text-[13px] font-bold transition-all border ${
                    surveyType === t
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-muted-foreground mb-1 block">설문 제목 (선택)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="자동 생성됩니다"
              className="w-full py-2 px-3 rounded-lg border text-[13px] bg-background"
            />
          </div>
        </div>

        <hr className="border-border/60" />

        <div>
          <label className="text-[12px] font-semibold text-muted-foreground mb-1 block">설명 (선택)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설문 안내 메시지를 입력하세요"
            rows={2}
            className="w-full py-2 px-3 rounded-lg border text-[13px] bg-background resize-none"
          />
        </div>

        <hr className="border-border/60" />

        {/* 설문 기간 설정 */}
        <div>
          <label className="text-[12px] font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            설문 기간
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] text-muted-foreground">시작일</span>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border text-[13px] bg-background"
              />
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground">종료일</span>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border text-[13px] bg-background"
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">기본: 생성일로부터 2주</p>
        </div>
      </div>

      {/* 질문 카드 목록 */}
      <div className="space-y-3 mb-4">
        {sortedFields.map((field, idx) => (
          <QuestionCard
            key={field.key}
            field={field}
            index={idx}
            total={sortedFields.length}
            onUpdate={(updates) => updateField(field.key, updates)}
            onDuplicate={() => duplicateField(field.key)}
            onDelete={() => deleteField(field.key)}
            onDragStart={() => setDraggedKey(field.key)}
            onDragOver={(e) => { e.preventDefault(); setDragOverKey(field.key); }}
            onDragEnd={() => { setDraggedKey(null); setDragOverKey(null); }}
            onDrop={(e) => { e.preventDefault(); if (draggedKey) handleDrop(draggedKey, field.key); }}
            isDragging={draggedKey === field.key}
            isDragOver={dragOverKey === field.key && draggedKey !== field.key}
          />
        ))}
      </div>

      {/* 질문 추가 버튼 */}
      <button
        type="button"
        onClick={addQuestion}
        className="w-full py-3.5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-[14px] font-semibold text-muted-foreground hover:text-primary mb-6"
      >
        <Plus className="w-5 h-5" />
        질문 추가
      </button>

      {/* 저장 버튼 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-[14px] hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            저장 중...
          </>
        ) : (
          isEditing ? "수정 완료" : "설문 폼 생성"
        )}
      </button>
    </div>
  );
}
