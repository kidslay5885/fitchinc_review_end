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
} from "lucide-react";

interface Props {
  onEdit: (form: SurveyForm) => void;
  onNew: () => void;
  refreshKey?: number;
}

export function SurveyFormList({ onEdit, onNew, refreshKey }: Props) {
  const [forms, setForms] = useState<SurveyForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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
        <h2 className="text-[16px] font-bold">설문 폼 목록</h2>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          새 설문 폼
        </button>
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
          <button
            onClick={onNew}
            className="mt-4 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity"
          >
            설문 폼 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <div
              key={form.id}
              className={`bg-card rounded-xl border p-4 transition-colors ${
                form.is_active ? "hover:border-primary/30" : "opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* 제목 + 상태 뱃지 */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[14px] font-bold truncate">
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
                  </div>

                  {/* 메타 정보: 통일된 회색 톤 */}
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span className="font-medium">{form.platform}</span>
                    <span className="text-border">·</span>
                    <span className="font-medium">{form.instructor}</span>
                    {form.cohort && (
                      <>
                        <span className="text-border">·</span>
                        <span>{form.cohort}</span>
                      </>
                    )}
                    <span className="text-border">·</span>
                    <span>{form.survey_type}</span>
                    <span className="text-border">·</span>
                    <span>{(form.fields as unknown[]).length}개 항목</span>
                  </div>
                </div>

                {/* 액션 버튼들 */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
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

                  {/* 활성/마감 토글 (하나의 버튼) */}
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
          ))}
        </div>
      )}
    </div>
  );
}
