"use client";

import { useState, useEffect } from "react";
import type { SurveyForm } from "@/lib/types";
import {
  Copy,
  Check,
  Pencil,
  Trash2,
  Loader2,
  Plus,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Calendar,
  Users,
  Settings2,
  X,
  GripVertical,
  CircleDot,
  ListChecks,
  Type,
  AlignLeft,
  Star,
  Hash,
  ImagePlus,
  RotateCcw,
} from "lucide-react";
import type { FormField } from "@/lib/types";
import {
  getPreDefaults,
  getPostDefaults,
  savePreDefaults,
  savePostDefaults,
  resetDefaults,
  PRE_SURVEY_DEFAULTS,
  POST_SURVEY_DEFAULTS,
} from "@/lib/form-utils";

// ===== 폼 고정값 설정 모달 =====

const FIELD_TYPE_LABELS: Record<string, string> = {
  radio: "객관식",
  select: "드롭다운",
  text: "단답형",
  textarea: "서술형",
  scale: "척도형",
  number: "숫자",
  image: "이미지",
};

function DefaultsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"사전" | "후기">("사전");
  const [preFields, setPreFields] = useState<FormField[]>(getPreDefaults);
  const [postFields, setPostDefaults] = useState<FormField[]>(getPostDefaults);
  const [saved, setSaved] = useState(false);

  const fields = tab === "사전" ? preFields : postFields;
  const setFields = tab === "사전" ? setPreFields : setPostDefaults;

  const handleSave = () => {
    savePreDefaults(preFields);
    savePostDefaults(postFields);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    if (!confirm(`${tab} 설문 고정값을 초기 상태로 되돌리시겠습니까?`)) return;
    resetDefaults(tab);
    if (tab === "사전") setPreFields(PRE_SURVEY_DEFAULTS.map((f) => ({ ...f })));
    else setPostDefaults(POST_SURVEY_DEFAULTS.map((f) => ({ ...f })));
  };

  const updateField = (key: string, updates: Partial<FormField>) => {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, ...updates } : f)));
  };

  const deleteField = (key: string) => {
    setFields((prev) => prev.filter((f) => f.key !== key));
  };

  const addField = () => {
    const id = Date.now().toString(36);
    const maxOrder = Math.max(0, ...fields.map((f) => f.order));
    setFields((prev) => [
      ...prev,
      { key: `custom_${id}`, label: "", type: "textarea", required: false, enabled: true, order: maxOrder + 1, section: "freetext", placeholder: "" },
    ]);
  };

  const sorted = [...fields].sort((a, b) => a.order - b.order);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-xl border w-[560px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-3">
            <Settings2 className="w-5 h-5 text-primary" />
            <h3 className="text-[15px] font-bold">폼 고정값 설정</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 px-5 pt-3">
          {(["사전", "후기"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {t} 설문
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:bg-accent transition-colors"
            title="초기값으로 되돌리기"
          >
            <RotateCcw className="w-3 h-3" />
            초기화
          </button>
        </div>

        {/* 질문 목록 */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          {sorted.map((field, idx) => (
            <div
              key={field.key}
              className={`rounded-lg border px-3 py-2.5 flex items-center gap-2 ${
                !field.enabled ? "opacity-45 bg-muted/30" : "bg-background"
              }`}
            >
              <span className="text-[12px] font-bold text-muted-foreground min-w-[18px] text-right">
                {idx + 1}
              </span>
              <input
                value={field.label}
                onChange={(e) => updateField(field.key, { label: e.target.value })}
                placeholder="질문 입력"
                className="flex-1 text-[13px] bg-transparent outline-none min-w-0"
              />
              <select
                value={field.type}
                onChange={(e) => updateField(field.key, { type: e.target.value as FormField["type"] })}
                className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0 outline-none cursor-pointer hover:bg-accent transition-colors"
              >
                {Object.entries(FIELD_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => updateField(field.key, { enabled: !field.enabled })}
                className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                  field.enabled ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-400"
                }`}
              >
                {field.enabled ? "표시" : "숨김"}
              </button>
              <button
                type="button"
                onClick={() => deleteField(field.key)}
                className="p-0.5 rounded hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
          ))}

          <button
            onClick={addField}
            className="w-full py-2.5 rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-[12px] text-muted-foreground hover:text-primary font-semibold"
          >
            + 질문 추가
          </button>
        </div>

        {/* 하단 버튼 */}
        <div className="px-5 py-3 border-t flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border text-[13px] font-bold text-muted-foreground hover:bg-accent transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                저장됨
              </>
            ) : (
              "저장"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 메인 목록 =====

interface Props {
  onEdit: (form: SurveyForm) => void;
  onNew: (type: "사전" | "후기" | "자유") => void;
  onResults?: (form: SurveyForm) => void;
  onBack?: () => void;
  refreshKey?: number;
}

// 응답 데이터 타입
interface FormResponse {
  name: string;
  gender: string;
  age: string;
  job: string;
  channel: string;
  ps1: number;
  ps2: number;
  p_rec: string;
  created_at: string;
  [key: string]: unknown;
}

/** 날짜 표시 포맷 (요일 포함) */
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
}

/** D-day 계산 */
function daysLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  return diff;
}

export function SurveyFormList({ onEdit, onNew, onResults, onBack, refreshKey }: Props) {
  const [forms, setForms] = useState<SurveyForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);

  // 결과 보기 상태
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responseData, setResponseData] = useState<Record<string, { responses: FormResponse[]; count: number; loading: boolean }>>({});

  const fetchForms = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/survey-forms");
      const data = await res.json();
      setForms(data.forms || []);
    } catch {
      console.error("폼 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, [refreshKey]);

  const handleCopy = (form: SurveyForm) => {
    const url = `${window.location.origin}/survey/${form.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(form.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleActive = async (form: SurveyForm) => {
    setTogglingId(form.id);
    try {
      const res = await fetch("/api/survey-forms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: form.id, is_active: !form.is_active }),
      });
      if (res.ok) {
        setForms((prev) =>
          prev.map((f) => (f.id === form.id ? { ...f, is_active: !f.is_active } : f))
        );
      }
    } catch {
      console.error("상태 변경 실패");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (form: SurveyForm) => {
    if (!confirm(`"${form.title}" 설문 폼을 삭제하시겠습니까?`)) return;
    setDeletingId(form.id);
    try {
      const res = await fetch("/api/survey-forms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: form.id }),
      });
      if (res.ok) {
        setForms((prev) => prev.filter((f) => f.id !== form.id));
      }
    } catch {
      console.error("삭제 실패");
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleResults = async (formId: string) => {
    if (expandedId === formId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(formId);

    // 이미 로드된 데이터가 있으면 재사용
    if (responseData[formId] && !responseData[formId].loading) return;

    setResponseData((prev) => ({
      ...prev,
      [formId]: { responses: [], count: 0, loading: true },
    }));

    try {
      const res = await fetch(`/api/survey-forms/responses?formId=${formId}`);
      const data = await res.json();
      setResponseData((prev) => ({
        ...prev,
        [formId]: { responses: data.responses || [], count: data.count || 0, loading: false },
      }));
    } catch {
      setResponseData((prev) => ({
        ...prev,
        [formId]: { responses: [], count: 0, loading: false },
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors"
              title="뒤로가기"
            >
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          <h2 className="text-[16px] font-bold">설문 폼 목록</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDefaults(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] font-bold text-muted-foreground hover:bg-accent transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            폼 고정값 설정
          </button>
          <div className="relative">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              새 설문 폼
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNewMenu ? "rotate-180" : ""}`} />
            </button>
            {showNewMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNewMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-card rounded-xl border shadow-xl py-1 w-[160px]">
                  <button
                    onClick={() => { setShowNewMenu(false); onNew("사전"); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold hover:bg-accent transition-colors"
                  >
                    <FileText className="w-4 h-4 text-blue-500" />
                    사전 설문
                  </button>
                  <button
                    onClick={() => { setShowNewMenu(false); onNew("후기"); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold hover:bg-accent transition-colors"
                  >
                    <FileText className="w-4 h-4 text-emerald-500" />
                    후기 설문
                  </button>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={() => { setShowNewMenu(false); onNew("자유"); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold hover:bg-accent transition-colors"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                    자유 형식
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {forms.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[14px] font-bold text-muted-foreground">
            아직 생성된 설문 폼이 없습니다
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">
            새 설문 폼을 만들어 수강생에게 공유하세요
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => onNew("사전")}
              className="px-4 py-2.5 rounded-lg border border-primary text-primary text-[13px] font-bold hover:bg-primary/5 transition-colors"
            >
              사전 설문
            </button>
            <button
              onClick={() => onNew("후기")}
              className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity"
            >
              후기 설문
            </button>
            <button
              onClick={() => onNew("자유")}
              className="px-4 py-2.5 rounded-lg border text-[13px] font-bold text-muted-foreground hover:bg-accent transition-colors"
            >
              자유 형식
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => {
            const isExpanded = expandedId === form.id;
            const rd = responseData[form.id];
            const days = daysLeft(form.expires_at);
            const startFmt = formatDate(form.starts_at);
            const endFmt = formatDate(form.expires_at);

            return (
              <div
                key={form.id}
                className={`bg-card rounded-xl border transition-colors ${
                  form.is_active ? "hover:border-primary/30" : "opacity-60"
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onResults ? onResults(form) : handleToggleResults(form.id)}
                    >
                      {/* 제목 + 상태 뱃지 */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[14px] font-bold truncate hover:text-primary transition-colors">
                          {form.title || `${form.instructor} ${form.survey_type} 설문`}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            form.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-gray-100 text-gray-500 border border-gray-200"
                          }`}
                        >
                          {form.is_active ? "활성" : "마감"}
                        </span>
                        {days !== null && form.is_active && (
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                              days <= 0
                                ? "bg-red-50 text-red-600 border border-red-200"
                                : days <= 3
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-blue-50 text-blue-600 border border-blue-200"
                            }`}
                          >
                            {days <= 0 ? "기한 만료" : `D-${days}`}
                          </span>
                        )}
                      </div>

                      {/* 메타 정보 */}
                      {startFmt && endFmt && (
                        <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>{startFmt}~{endFmt}</span>
                        </div>
                      )}
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {/* 결과 보기 토글 */}
                      <button
                        onClick={() => handleToggleResults(form.id)}
                        title="결과 보기"
                        className={`p-2 rounded-lg hover:bg-accent transition-colors ${isExpanded ? "bg-accent" : ""}`}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-primary" />
                        ) : (
                          <Users className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>

                      {/* URL 복사 */}
                      <button
                        onClick={() => handleCopy(form)}
                        title="URL 복사"
                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                      >
                        {copiedId === form.id ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>

                      {/* 활성/마감 토글 */}
                      <button
                        onClick={() => handleToggleActive(form)}
                        disabled={togglingId === form.id}
                        title={form.is_active ? "설문 마감하기" : "설문 다시 열기"}
                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                      >
                        {togglingId === form.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <span className="text-[11px] font-semibold text-muted-foreground leading-none">
                            {form.is_active ? "마감" : "열기"}
                          </span>
                        )}
                      </button>

                      {/* 편집 */}
                      <button
                        onClick={() => onEdit(form)}
                        title="편집"
                        className="p-2 rounded-lg hover:bg-accent transition-colors"
                      >
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>

                      {/* 삭제 */}
                      <button
                        onClick={() => handleDelete(form)}
                        disabled={deletingId === form.id}
                        title="삭제"
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        {deletingId === form.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 결과 패널 */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 bg-muted/30 rounded-b-xl">
                    {rd?.loading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="ml-2 text-[13px] text-muted-foreground">응답 불러오는 중...</span>
                      </div>
                    ) : !rd || rd.responses.length === 0 ? (
                      <div className="text-center py-6">
                        <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-[14px] font-bold text-muted-foreground">아직 응답이 없습니다</p>
                        <p className="text-[12px] text-muted-foreground mt-1">
                          설문 URL을 수강생에게 공유하면 여기에 응답이 표시됩니다
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[13px] font-bold">
                            총 {rd.responses.length}명 응답
                          </span>
                        </div>

                        {/* 응답 테이블 */}
                        <div className="overflow-x-auto rounded-lg border bg-card">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="bg-muted/50 border-b">
                                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">#</th>
                                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">이름</th>
                                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">성별</th>
                                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">연령대</th>
                                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">직업</th>
                                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">경로</th>
                                {form.survey_type === "후기" && (
                                  <>
                                    <th className="py-2 px-3 text-center font-semibold text-muted-foreground">커리큘럼</th>
                                    <th className="py-2 px-3 text-center font-semibold text-muted-foreground">피드백</th>
                                    <th className="py-2 px-3 text-left font-semibold text-muted-foreground">추천</th>
                                  </>
                                )}
                                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">응답일</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rd.responses.map((r, i) => (
                                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                                  <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                                  <td className="py-2 px-3 font-medium">{r.name || "-"}</td>
                                  <td className="py-2 px-3">{r.gender || "-"}</td>
                                  <td className="py-2 px-3">{r.age || "-"}</td>
                                  <td className="py-2 px-3">{r.job || "-"}</td>
                                  <td className="py-2 px-3">{r.channel || "-"}</td>
                                  {form.survey_type === "후기" && (
                                    <>
                                      <td className="py-2 px-3 text-center">{r.ps1 || "-"}</td>
                                      <td className="py-2 px-3 text-center">{r.ps2 || "-"}</td>
                                      <td className="py-2 px-3 max-w-[120px] truncate">{r.p_rec || "-"}</td>
                                    </>
                                  )}
                                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                                    {r.created_at ? new Date(r.created_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "-"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showDefaults && <DefaultsModal onClose={() => setShowDefaults(false)} />}
    </div>
  );
}
