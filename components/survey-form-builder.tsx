"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { FormField, SurveyForm } from "@/lib/types";
import { getPreDefaults, getPostDefaults, applyPlatformName, getDefaultDescription, getDefaultDuration } from "@/lib/form-utils";
import { PLATFORM_NAMES } from "@/lib/constants";
import { RichTextEditor } from "@/components/rich-text-editor";
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
  Settings2,
  ShieldCheck,
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
  { value: "consent" as const, label: "개인정보 수집 / 제공 동의", icon: <ShieldCheck className="w-4 h-4" />, desc: "동의 항목" },
] as const;

function getTypeLabel(type: string) {
  return FIELD_TYPES.find((t) => t.value === type)?.label || type;
}
function getTypeIcon(type: string) {
  return FIELD_TYPES.find((t) => t.value === type)?.icon || <Type className="w-4 h-4" />;
}

// ===== 척도 설정 (큰 미리보기 + 접이식 세부 설정) =====

function ScaleSection({
  scaleMin,
  scaleMax,
  scaleNums,
  onUpdate,
}: {
  scaleMin: number;
  scaleMax: number;
  scaleNums: number[];
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);

  const count = scaleNums.length;
  const itemGap = count > 10 ? "gap-1" : count > 7 ? "gap-2" : "gap-4";
  const numSize = count > 10 ? "text-[10px]" : count > 7 ? "text-[12px]" : "text-[14px]";
  const circleSize = count > 10 ? "w-4 h-4" : count > 7 ? "w-5 h-5" : "w-6 h-6";

  return (
    <div className="px-4 pb-2">
      {/* 큰 척도 미리보기 — 네이버폼 스타일 */}
      <div className={`flex items-end justify-center ${itemGap} py-3 flex-wrap`}>
        <span className="text-[12px] text-muted-foreground font-medium pb-1 shrink-0">매우 불만족</span>
        {scaleNums.map((n) => (
          <div key={n} className="flex flex-col items-center gap-1.5">
            <span className={`${numSize} font-bold text-foreground`}>{n}</span>
            <span className={`${circleSize} rounded-full border-2 border-gray-300 hover:border-primary/50 transition-colors`} />
          </div>
        ))}
        <span className="text-[12px] text-muted-foreground font-medium pb-1 shrink-0">매우 만족</span>
      </div>

      {/* 세부 설정 토글 */}
      <button
        type="button"
        onClick={() => setShowSettings(!showSettings)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-1"
      >
        <Settings2 className="w-3 h-3" />
        점수 범위 설정
        <ChevronDown className={`w-3 h-3 transition-transform ${showSettings ? "rotate-180" : ""}`} />
      </button>

      {showSettings && (
        <div className="flex items-center gap-2 mt-2 text-[12px] pb-1">
          <span className="text-muted-foreground text-[11px]">점수 {scaleMin}일 경우</span>
          <span className="text-[11px] font-medium">매우 불만족</span>
          <span className="text-muted-foreground mx-1">|</span>
          <input
            type="number"
            value={scaleMin}
            onChange={(e) => onUpdate({ scaleMin: parseInt(e.target.value) || 1 })}
            className="w-12 py-1.5 px-2 rounded border text-[12px] bg-background text-center"
          />
          <span className="text-muted-foreground">~</span>
          <input
            type="number"
            value={scaleMax}
            onChange={(e) => onUpdate({ scaleMax: parseInt(e.target.value) || 5 })}
            className="w-12 py-1.5 px-2 rounded border text-[12px] bg-background text-center"
          />
          <span className="text-muted-foreground text-[11px]">점수 {scaleMax}일 경우</span>
          <span className="text-[11px] font-medium">매우 만족</span>
        </div>
      )}
    </div>
  );
}

// ===== 개인정보 동의 설정 =====

function ConsentSection({
  consentConfig,
  onUpdate,
}: {
  consentConfig: NonNullable<FormField["consentConfig"]>;
  onUpdate: (updates: Partial<FormField>) => void;
}) {
  const [tab, setTab] = useState<"collect" | "thirdParty">("collect");

  const updateConfig = (key: string, value: string) => {
    onUpdate({ consentConfig: { ...consentConfig, [key]: value } });
  };

  return (
    <div className="px-4 pb-2">
      {/* 탭 전환 */}
      <div className="flex items-center gap-3 mb-3">
        {(["collect", "thirdParty"] as const).map((t) => {
          const active = tab === t;
          const label = t === "collect" ? "개인정보 수집 및 이용 동의" : "개인정보 제 3자 제공 동의";
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 select-none`}
            >
              <span
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  active ? "border-emerald-500" : "border-gray-300"
                }`}
              >
                {active && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
              </span>
              <span className={`text-[12px] ${active ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 수집 및 이용 동의 */}
      {tab === "collect" && (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 border-b border-border/50">
            <span className="text-[11px] font-bold text-muted-foreground">개인정보 수집 및 이용 동의</span>
          </div>
          <div className="divide-y divide-border/40">
            {([
              { key: "collectItems", label: "수집하는 개인정보 항목", ph: "ex) 이름, 연락처" },
              { key: "collectPurpose", label: "수집 및 이용 목적", ph: "ex) 이벤트 진행 및 당첨자 안내" },
              { key: "collectRetention", label: "보유 및 이용기간", ph: "ex) 당첨자 발표 후 1개월 보관" },
            ] as const).map((item) => (
              <div key={item.key} className="flex items-center gap-3 px-3 py-2.5">
                <span className="text-[12px] text-muted-foreground w-[130px] flex-shrink-0">· {item.label}</span>
                <input
                  value={(consentConfig as Record<string, string>)[item.key] || ""}
                  onChange={(e) => updateConfig(item.key, e.target.value)}
                  placeholder={item.ph}
                  className="flex-1 text-[12px] bg-transparent outline-none border-b border-transparent hover:border-gray-300 focus:border-primary/40 py-1 transition-colors placeholder:text-gray-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 제 3자 제공 동의 */}
      {tab === "thirdParty" && (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="bg-muted/30 px-3 py-2 border-b border-border/50">
            <span className="text-[11px] font-bold text-muted-foreground">개인정보 제 3자 제공 동의</span>
          </div>
          <div className="divide-y divide-border/40">
            {([
              { key: "thirdPartyRecipient", label: "제공받는 자", ph: "ex) (주) 제휴사명" },
              { key: "thirdPartyPurpose", label: "제공받는 자의 이용 목적", ph: "ex) 이벤트 진행 및 당첨자 안내" },
              { key: "thirdPartyItems", label: "제공하는 항목", ph: "ex) 이름, 연락처" },
              { key: "thirdPartyRetention", label: "제공받는 자의 보유 및 이용기간", ph: "ex) 당첨자 발표 후 1개월 보관" },
            ] as const).map((item) => (
              <div key={item.key} className="flex items-center gap-3 px-3 py-2.5">
                <span className="text-[12px] text-muted-foreground w-[170px] flex-shrink-0">· {item.label}</span>
                <input
                  value={(consentConfig as Record<string, string>)[item.key] || ""}
                  onChange={(e) => updateConfig(item.key, e.target.value)}
                  placeholder={item.ph}
                  className="flex-1 text-[12px] bg-transparent outline-none border-b border-transparent hover:border-gray-300 focus:border-primary/40 py-1 transition-colors placeholder:text-gray-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
  const [collapsed, setCollapsed] = useState(false);
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

  // 옵션 드래그 순서 변경
  const [dragOptIdx, setDragOptIdx] = useState<number | null>(null);
  const [overOptIdx, setOverOptIdx] = useState<number | null>(null);

  const handleOptDrop = (toIdx: number) => {
    if (dragOptIdx === null || dragOptIdx === toIdx) return;
    const current = [...(field.options || [])];
    const [moved] = current.splice(dragOptIdx, 1);
    current.splice(toIdx, 0, moved);
    onUpdate({ options: current });
    setDragOptIdx(null);
    setOverOptIdx(null);
  };

  // 접힌 상태: 질문 미리보기 + 척도/객관식 프리뷰
  const scaleMin = field.scaleMin ?? 1;
  const scaleMax = field.scaleMax ?? 5;
  const scaleNums = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);

  return (
    <div
      draggable
      onDragStart={(e) => {
        if (!handleRef.current?.contains(e.target as Node)) {
          e.preventDefault();
          return;
        }
        onDragStart();
      }}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={`transition-all ${
        isDragging ? "opacity-40 scale-[0.98]" :
        isDragOver ? "bg-primary/5" : ""
      } ${collapsed
        ? "border-b border-border hover:bg-accent/30"
        : "bg-card rounded-xl border-2 border-blue-200 shadow-md my-1"
      }`}
    >
      {/* 접힌 상태 — 한 줄 슬림 리스트 */}
      <div
        className={`cursor-pointer flex items-center gap-2 ${collapsed ? "px-3 py-2.5" : "px-4 py-3"}`}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div
          ref={handleRef}
          className="flex items-center justify-center w-5 cursor-grab active:cursor-grabbing flex-shrink-0"
          title="드래그하여 순서 변경"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/40" />
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {field.required && <span className="text-red-500 text-[13px] font-bold">*</span>}
          <span className="text-[12px] text-blue-600 font-bold">{index + 1}.</span>
          <span className={`text-[13px] truncate ${collapsed ? "font-medium" : "font-semibold"}`}>
            {field.label || "(질문 없음)"}
          </span>
        </div>

        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
          {getTypeLabel(field.type)}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${!collapsed ? "rotate-180" : ""}`} />
      </div>

      {/* 펼친 상태 — 전체 편집 UI (네이버폼 비율) */}
      {!collapsed && (
        <>
          <div className="border-t border-blue-100" />

          {/* 타입 드롭다운 — 작고 조용하게 */}
          <div className="px-4 pt-3 pb-0">
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setTypeOpen(!typeOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-muted/40 hover:bg-accent text-[11px] text-muted-foreground font-medium transition-colors whitespace-nowrap"
              >
                {getTypeIcon(field.type)}
                {getTypeLabel(field.type)}
                <ChevronDown className={`w-3 h-3 transition-transform ${typeOpen ? "rotate-180" : ""}`} />
              </button>

              {typeOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setTypeOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-20 bg-card rounded-xl border shadow-xl py-1 w-[200px]">
                    {FIELD_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          const updates: Partial<FormField> = { type: t.value };
                          if ((t.value === "radio" || t.value === "select") && !field.options?.length) {
                            updates.options = ["항목 1", "항목 2"];
                          }
                          if (t.value === "scale") {
                            updates.scaleMin = field.scaleMin ?? 1;
                            updates.scaleMax = field.scaleMax ?? 5;
                          }
                          if (t.value === "consent" && !field.consentConfig) {
                            updates.consentConfig = {
                              collectItems: "이름, 연락처",
                              collectPurpose: "강의 수강 관리 및 안내",
                              collectRetention: "강의 종료 후 1개월 보관",
                            };
                            updates.required = true;
                          }
                          onUpdate(updates);
                          setTypeOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] hover:bg-accent transition-colors whitespace-nowrap ${
                          field.type === t.value ? "text-primary font-bold bg-primary/5" : "text-foreground"
                        }`}
                      >
                        <span className="text-muted-foreground">{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 질문 제목 — 크고 볼드하게 */}
          <div className="px-4 pt-1.5 pb-0">
            <input
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="질문 입력"
              className="w-full text-[16px] font-bold bg-transparent outline-none border-b border-transparent hover:border-gray-300 focus:border-primary/40 py-1.5 transition-colors placeholder:text-gray-300 placeholder:font-normal"
            />
          </div>

          {/* 질문 설명 */}
          <div className="px-4 pb-2">
            <textarea
              value={field.placeholder || ""}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              placeholder="설명 입력"
              rows={1}
              onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
              className="w-full text-[13px] text-muted-foreground bg-transparent outline-none border-b border-transparent hover:border-gray-300 focus:border-primary/40 py-1 transition-colors placeholder:text-gray-300 resize-none overflow-hidden"
            />

            {/* 설명 이미지 첨부 */}
            {field.descriptionImage ? (
              <div className="relative inline-block mt-2">
                <img
                  src={field.descriptionImage}
                  alt="설명 이미지"
                  className="max-h-24 rounded-md border object-cover"
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
                  className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors disabled:opacity-50"
                >
                  {uploadingDescImg ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  이미지 첨부
                </button>
              </>
            )}
          </div>

          {/* 이미지 업로드 타입 안내 */}
          {field.type === "image" && (
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-700">
                <ImagePlus className="w-3.5 h-3.5 flex-shrink-0" />
                이미지 업로드 (최대 5MB, JPG/PNG/WebP)
              </div>
            </div>
          )}

          {/* 단답형/장문형 미리보기 */}
          {field.type === "text" && (
            <div className="px-4 pb-2">
              <div className="py-2.5 px-3 rounded-lg bg-muted/30 border border-border/50 text-[12px] text-muted-foreground/50">
                참여자의 답변 입력란 (최대 100자)
              </div>
            </div>
          )}
          {field.type === "textarea" && (
            <div className="px-4 pb-2">
              <div className="py-2.5 px-3 rounded-lg bg-muted/30 border border-border/50 text-[12px] text-muted-foreground/50 min-h-[60px]">
                참여자의 답변 입력란 (최대 2000자)
              </div>
            </div>
          )}

          {/* 옵션 목록 (객관식) */}
          {hasOptions && (
            <div className="px-4 pb-2">
              <div className="space-y-0.5">
                {(field.options || []).map((opt, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => setDragOptIdx(i)}
                    onDragOver={(e) => { e.preventDefault(); setOverOptIdx(i); }}
                    onDragEnd={() => { setDragOptIdx(null); setOverOptIdx(null); }}
                    onDrop={(e) => { e.preventDefault(); handleOptDrop(i); }}
                    className={`flex items-center gap-1.5 group transition-all ${
                      dragOptIdx === i ? "opacity-40" : overOptIdx === i && dragOptIdx !== null ? "bg-primary/5" : ""
                    }`}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground/30 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                    <span className={`w-4 h-4 flex-shrink-0 border-2 border-gray-300 ${field.multiple ? "rounded" : "rounded-full"}`} />
                    <div className="flex-1 flex items-center border-b border-border/60 hover:border-gray-400 focus-within:border-primary/40 transition-colors">
                      <input
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`항목 ${i + 1}`}
                        className="flex-1 py-1.5 text-[13px] bg-transparent outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                      >
                        <X className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addOption}
                className="mt-2 px-3 py-1 rounded-md bg-blue-50 text-[12px] font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
              >
                항목 추가
              </button>
            </div>
          )}

          {/* 척도 설정 */}
          {field.type === "scale" && (
            <ScaleSection
              scaleMin={scaleMin}
              scaleMax={scaleMax}
              scaleNums={scaleNums}
              onUpdate={onUpdate}
            />
          )}

          {/* 개인정보 동의 설정 */}
          {field.type === "consent" && (
            <ConsentSection
              consentConfig={field.consentConfig || {}}
              onUpdate={onUpdate}
            />
          )}

          {/* 하단: 필수 토글 + 액션 버튼 */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-blue-100 mt-1">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <span className="text-[11px] font-semibold text-muted-foreground">답변 필수</span>
                <button
                  type="button"
                  onClick={() => onUpdate({ required: !field.required })}
                  className={`w-9 h-[20px] rounded-full relative transition-colors ${
                    field.required ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      field.required ? "left-[19px]" : "left-[2px]"
                    }`}
                  />
                </button>
              </label>

              {hasOptions && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <span className="text-[11px] font-semibold text-muted-foreground">복수 선택</span>
                  <button
                    type="button"
                    onClick={() => onUpdate({ multiple: !field.multiple })}
                    className={`w-9 h-[20px] rounded-full relative transition-colors ${
                      field.multiple ? "bg-violet-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        field.multiple ? "left-[19px]" : "left-[2px]"
                      }`}
                    />
                  </button>
                </label>
              )}
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onDuplicate}
                className="p-1.5 rounded-md hover:bg-accent transition-colors"
                title="복제"
              >
                <CopyIcon className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                title="삭제"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ===== 질문 목차 사이드바 =====

function QuestionOutlineSidebar({
  fields,
  activeKey,
  onClickItem,
  onReorder,
  formTitle,
  closingMessage,
}: {
  fields: FormField[];
  activeKey: string | null;
  onClickItem: (key: string) => void;
  onReorder: (fromKey: string, toKey: string) => void;
  formTitle: string;
  closingMessage: string;
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  // position:fixed 기반 — 스크롤과 무관하게 화면에 고정 표시
  const anchorRef = useRef<HTMLDivElement>(null);
  const [fixedLeft, setFixedLeft] = useState<number | null>(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const update = () => {
      const rect = anchor.getBoundingClientRect();
      setFixedLeft(rect.left);
    };

    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, { capture: true } as EventListenerOptions);
    };
  }, []);

  return (
    <div ref={anchorRef} className="w-[230px] flex-shrink-0 h-full">
      <div
        className="fixed top-[80px] z-30"
        style={fixedLeft !== null ? { left: fixedLeft, width: 230 } : { display: "none" }}
      >
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          {/* 헤더 */}
          <div className="px-4 pt-3 pb-1.5">
            <span className="text-[13px] font-bold text-blue-600 border-b-2 border-blue-500 pb-1">
              목차
            </span>
          </div>

          {/* 질문 목록 */}
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-2.5 pb-2.5 space-y-1">
            {/* 설문 제목 */}
            <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2">
              <span className={`text-[12px] ${formTitle.trim() ? "text-foreground" : "text-muted-foreground"}`}>
                {formTitle.trim() || "(설문 제목 없음)"}
              </span>
            </div>

            {/* 질문 항목들 */}
            {fields.map((field, idx) => {
              const isActive = activeKey === field.key;
              const isDragging = dragKey === field.key;
              const isDragOver = overKey === field.key && dragKey && dragKey !== field.key;
              const hasLabel = !!field.label;

              return (
                <div
                  key={field.key}
                  draggable
                  onDragStart={() => setDragKey(field.key)}
                  onDragOver={(e) => { e.preventDefault(); setOverKey(field.key); }}
                  onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragKey && dragKey !== field.key) onReorder(dragKey, field.key);
                    setDragKey(null);
                    setOverKey(null);
                  }}
                  onClick={() => onClickItem(field.key)}
                  className={`rounded-md border px-2.5 py-2 flex items-center gap-1.5 cursor-pointer select-none transition-all ${
                    isDragging ? "opacity-40 scale-[0.97] border-border" :
                    isDragOver ? "border-blue-400 bg-blue-50 shadow-sm" :
                    isActive
                      ? "border-blue-400 bg-white shadow-sm ring-1 ring-blue-200"
                      : "border-border/50 bg-white hover:border-border hover:shadow-sm"
                  } ${!field.enabled ? "opacity-45" : ""}`}
                >
                  {/* 타입 아이콘 */}
                  <span className={`flex-shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5 ${
                    isActive ? "text-blue-600" : "text-muted-foreground/50"
                  }`}>
                    {getTypeIcon(field.type)}
                  </span>

                  {/* 번호 + 질문 */}
                  <span className={`flex-1 min-w-0 text-[12px] truncate ${
                    hasLabel
                      ? isActive ? "text-foreground font-medium" : "text-foreground"
                      : "text-muted-foreground"
                  }`}>
                    {idx + 1}. {hasLabel ? field.label : "(질문 없음)"}
                  </span>

                  {/* 드래그 핸들 */}
                  <GripVertical className={`w-3.5 h-3.5 flex-shrink-0 cursor-grab active:cursor-grabbing ${
                    isActive ? "text-muted-foreground/40" : "text-muted-foreground/25"
                  }`} />
                </div>
              );
            })}

            {fields.length === 0 && (
              <p className="text-[12px] text-muted-foreground text-center py-4">
                질문이 없습니다
              </p>
            )}

            {/* 마지막 메시지 (실제 설문에 표시됨) */}
            <div className="rounded-md border border-emerald-300 bg-emerald-50/30 px-2.5 py-2">
              <span className="text-[11px] text-emerald-700">
                {closingMessage || "(마지막 안내 메시지)"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== 메인 빌더 =====

interface Props {
  editForm?: SurveyForm | null;
  initialType?: "사전" | "후기" | "자유";
  onSaved: (form: SurveyForm) => void;
  onCancel: () => void;
}

/** 오늘 날짜를 YYYY-MM-DD 형식으로 (로컬 타임존 기준) */
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** 오늘 + N일 (로컬 타임존 기준) */
function futureDateStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SurveyFormBuilder({ editForm, initialType, onSaved, onCancel }: Props) {
  const isEditing = !!editForm;
  const resolvedType = editForm?.survey_type || initialType || "후기";
  // DB에 저장할 survey_type (자유 → 사전으로 저장)
  const dbSurveyType = resolvedType === "자유" ? "사전" : resolvedType;

  const [platform, setPlatform] = useState(editForm?.platform || PLATFORM_NAMES[0]);
  const [instructor, setInstructor] = useState(editForm?.instructor || "");
  const [course, setCourse] = useState(editForm?.course || "");
  const [cohort, setCohort] = useState(editForm?.cohort || "");
  const [surveyType, setSurveyType] = useState<"사전" | "후기">(dbSurveyType);
  const [titleManual, setTitleManual] = useState(editForm?.title || "");
  const [titleOverride, setTitleOverride] = useState(!!editForm?.title);
  const [description, setDescription] = useState(
    isEditing ? (editForm?.description || "") : getDefaultDescription(dbSurveyType, platform)
  );
  const [startsAt, setStartsAt] = useState(editForm?.starts_at?.slice(0, 10) || todayStr());
  const [expiresAt, setExpiresAt] = useState(editForm?.expires_at?.slice(0, 10) || futureDateStr(getDefaultDuration()));
  const isFreeForm = initialType === "자유";
  const existingFields = editForm?.fields?.length ? (editForm.fields as FormField[]) : null;
  const [fields, setFields] = useState<FormField[]>(
    existingFields
      ? existingFields.filter((f) => f.type !== "closing")
      : isFreeForm ? [] : resolvedType === "사전" ? getPreDefaults(platform) : getPostDefaults(platform)
  );
  const [closingMessage, setClosingMessage] = useState(
    existingFields?.find((f) => f.type === "closing")?.label || "설문 작성해주셔서 감사합니다."
  );

  // 자동 제목: 플랫폼 / 강사명 / 강의명 / 기수 / 사전|후기 설문지
  const autoTitle = [platform, instructor.trim(), course.trim(), cohort.trim()]
    .filter(Boolean)
    .join(" ") + ` ${surveyType} 설문지`;
  const title = titleOverride ? titleManual : autoTitle;

  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 드래그 상태
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // 사이드바 활성 질문 추적
  const [activeQuestionKey, setActiveQuestionKey] = useState<string | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToQuestion = useCallback((key: string) => {
    const el = questionRefs.current[key];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveQuestionKey(key);
      // 하이라이트 효과
      el.classList.add("ring-2", "ring-primary/40");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/40"), 1500);
    }
  }, []);

  // IntersectionObserver로 보이는 질문 추적
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute("data-question-key");
            if (key) setActiveQuestionKey(key);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );

    const refs = questionRefs.current;
    for (const el of Object.values(refs)) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [fields]);

  // 플랫폼 변경 시 기존 필드의 라벨/옵션 + 설명도 갱신
  const prevPlatformRef = useRef(platform);
  useEffect(() => {
    const prev = prevPlatformRef.current;
    if (prev === platform) return;
    prevPlatformRef.current = platform;
    setFields((cur) =>
      cur.map((f) => {
        const label = f.label.replaceAll(prev, platform);
        const options = f.options?.map((o) => o.replaceAll(prev, platform));
        if (label === f.label && !f.options?.some((o, i) => o !== options?.[i])) return f;
        return { ...f, label, options };
      })
    );
    setDescription((cur) => cur.replaceAll(prev, platform));
  }, [platform]);

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

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const confirmDelete = () => {
    if (deleteTarget) {
      setFields((prev) => prev.filter((f) => f.key !== deleteTarget));
      setDeleteTarget(null);
    }
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
        title: title.trim(),
        description: description.trim(),
        fields: [
          ...fields,
          { key: "_closing", label: closingMessage, type: "closing" as const, required: false, enabled: true, order: 99999, section: "freetext" as const },
        ],
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

      if (isEditing) {
        onCancel();
        return;
      }

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
    <div className="flex gap-6 justify-center pb-8 items-stretch">
      {/* 메인 폼 영역 */}
      <div className="max-w-2xl w-full">
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
        <div className="bg-card rounded-xl border p-4 mb-3">
          <h3 className="text-[13px] font-bold mb-3">기본 정보</h3>

          <div className="grid grid-cols-4 gap-2 mb-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">플랫폼</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full py-1.5 px-2 rounded-md border text-[12px] bg-background"
              >
                {PLATFORM_NAMES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">강사명 *</label>
              <input
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
                placeholder="머니테이커"
                className="w-full py-1.5 px-2 rounded-md border text-[12px] bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">강의명</label>
              <input
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="파이널VIP 코스"
                className="w-full py-1.5 px-2 rounded-md border text-[12px] bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">기수</label>
              <input
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                placeholder="21기"
                className="w-full py-1.5 px-2 rounded-md border text-[12px] bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">설문 유형</label>
              {isFreeForm ? (
                <div className="flex gap-1.5">
                  {(["사전", "후기"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSurveyType(t)}
                      className={`flex-1 py-1.5 rounded-md text-[12px] font-bold transition-all border ${
                        surveyType === t
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-1.5 px-2 rounded-md border bg-muted/30 text-[12px] font-bold text-foreground">
                  {surveyType} 설문
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">설문 제목</label>
              <input
                value={title}
                onChange={(e) => { setTitleOverride(true); setTitleManual(e.target.value); }}
                placeholder="자동 생성됩니다"
                className={`w-full py-1.5 px-2 rounded-md border text-[12px] bg-background hover:border-gray-400 focus:border-primary/40 transition-colors ${
                  !titleOverride ? "text-muted-foreground" : ""
                }`}
              />
            </div>
          </div>

          <div className="mb-2">
            <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">설명 (선택)</label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="설문 안내 메시지를 입력하세요"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                시작일
              </label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full py-1.5 px-2 rounded-md border text-[12px] bg-background"
              />
            </div>
            <span className="text-muted-foreground text-[12px] pb-2">~</span>
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-muted-foreground mb-0.5 block">종료일</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full py-1.5 px-2 rounded-md border text-[12px] bg-background"
              />
            </div>
          </div>
        </div>

        {/* 질문 카드 목록 */}
        <div className="space-y-1 mb-3">
          {sortedFields.map((field, idx) => (
            <div
              key={field.key}
              ref={(el) => { questionRefs.current[field.key] = el; }}
              data-question-key={field.key}
              className="transition-all"
            >
              <QuestionCard
                field={field}
                index={idx}
                total={sortedFields.length}
                onUpdate={(updates) => updateField(field.key, updates)}
                onDuplicate={() => duplicateField(field.key)}
                onDelete={() => setDeleteTarget(field.key)}
                onDragStart={() => setDraggedKey(field.key)}
                onDragOver={(e) => { e.preventDefault(); setDragOverKey(field.key); }}
                onDragEnd={() => { setDraggedKey(null); setDragOverKey(null); }}
                onDrop={(e) => { e.preventDefault(); if (draggedKey) handleDrop(draggedKey, field.key); }}
                isDragging={draggedKey === field.key}
                isDragOver={dragOverKey === field.key && draggedKey !== field.key}
              />
            </div>
          ))}
        </div>

        {/* 질문 추가 + 마지막 메시지 */}
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={addQuestion}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <Plus className="w-4 h-4" />
            질문 추가
          </button>
        </div>

        {/* 마지막 안내 메시지 (고정) */}
        <div className="bg-card rounded-lg border-2 border-emerald-300 px-4 py-3 mb-4">
          <input
            value={closingMessage}
            onChange={(e) => setClosingMessage(e.target.value)}
            className="w-full text-[14px] font-semibold bg-transparent outline-none border-b border-transparent hover:border-gray-300 focus:border-primary/40 py-0.5 transition-colors"
            placeholder="마지막 안내 메시지 입력"
          />
        </div>

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

      {/* 오른쪽 질문 목차 사이드바 (스크롤 따라옴) */}
      <div className="hidden xl:block self-stretch">
        <QuestionOutlineSidebar
          fields={sortedFields}
          activeKey={activeQuestionKey}
          onClickItem={scrollToQuestion}
          onReorder={handleDrop}
          formTitle={title}
          closingMessage={closingMessage}
        />
      </div>

      {/* 질문 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
          <div className="bg-card rounded-2xl shadow-xl border p-6 w-[280px]" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold text-center mb-5">질문을 삭제하시겠습니까?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-blue-400 text-blue-600 font-bold text-[14px] hover:bg-blue-50 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white font-bold text-[14px] hover:bg-blue-600 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
