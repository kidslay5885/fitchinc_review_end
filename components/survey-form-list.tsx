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
  Gift,
  ClipboardCopy,
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

// ===== 기프티쇼 관리 뷰 =====

interface GiftResponse {
  id: string;
  survey_id: string;
  name: string;
  phone: string;
  gift_sent: boolean;
  gift_sent_at: string | null;
  gift_amount: number;
  created_at: string;
  instructor: string;
  cohort: string;
  formId: string;
}

type GroupStatus = "완료" | "진행중" | "시작 전";
function getGroupStatus(sent: number, total: number): GroupStatus {
  if (total === 0) return "시작 전";
  if (sent === total) return "완료";
  if (sent > 0) return "진행중";
  return "시작 전";
}

function GiftManagementView() {
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<GiftResponse[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterInstructor, setFilterInstructor] = useState("전체");
  const [filterCohort, setFilterCohort] = useState("전체");
  const [filterStatus, setFilterStatus] = useState<"전체" | "미발송" | "발송완료">("전체");
  const [overviewFilter, setOverviewFilter] = useState<Set<GroupStatus>>(new Set(["완료", "진행중", "시작 전"]));
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [overviewOpen, setOverviewOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/survey-forms/responses?giftMode=true");
        const data = await res.json();
        setResponses(data.responses || []);
      } catch {
        console.error("기프티쇼 데이터 조회 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 필터 옵션: 강사 목록 + 강사→기수 연동
  const instructors = [...new Set(responses.map((r) => r.instructor))].filter(Boolean).sort();
  const cohorts = filterInstructor === "전체"
    ? [...new Set(responses.map((r) => r.cohort))].filter(Boolean).sort()
    : [...new Set(responses.filter((r) => r.instructor === filterInstructor).map((r) => r.cohort))].filter(Boolean).sort();

  // 강사 변경 시 기수 리셋
  const handleInstructorChange = (v: string) => {
    setFilterInstructor(v);
    setFilterCohort("전체");
    setSelected(new Set());
  };

  // 강사+기수별 그룹 현황
  const groups = (() => {
    const map: Record<string, { instructor: string; cohort: string; total: number; sent: number; totalAmount: number }> = {};
    for (const r of responses) {
      const key = `${r.instructor}||${r.cohort}`;
      if (!map[key]) map[key] = { instructor: r.instructor, cohort: r.cohort, total: 0, sent: 0, totalAmount: 0 };
      map[key].total++;
      if (r.gift_sent) map[key].sent++;
      map[key].totalAmount += r.gift_amount || 0;
    }
    return Object.values(map).sort((a, b) => {
      if (a.instructor !== b.instructor) return a.instructor.localeCompare(b.instructor);
      return a.cohort.localeCompare(b.cohort);
    });
  })();

  const filteredGroups = groups.filter((g) => overviewFilter.has(getGroupStatus(g.sent, g.total)));

  const toggleOverviewFilter = (status: GroupStatus) => {
    setOverviewFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        if (next.size > 1) next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const totalAll = responses.length;
  const sentAll = responses.filter((r) => r.gift_sent).length;
  const unsentAll = totalAll - sentAll;

  // 필터링된 응답
  const filtered = responses.filter((r) => {
    if (filterInstructor !== "전체" && r.instructor !== filterInstructor) return false;
    if (filterCohort !== "전체" && r.cohort !== filterCohort) return false;
    if (filterStatus === "미발송" && r.gift_sent) return false;
    if (filterStatus === "발송완료" && !r.gift_sent) return false;
    return true;
  });

  const unsentCount = filtered.filter((r) => !r.gift_sent).length;
  const sentCount = filtered.filter((r) => r.gift_sent).length;

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopy = () => {
    const targets = selected.size > 0
      ? filtered.filter((r) => selected.has(r.id))
      : filtered.filter((r) => !r.gift_sent);
    if (targets.length === 0) return;
    const text = targets.map((r) => `${r.name}\t${r.phone || ""}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGiftToggle = async (gift_sent: boolean) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/gift-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseIds: ids, gift_sent }),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setResponses((prev) =>
          prev.map((r) =>
            ids.includes(r.id)
              ? { ...r, gift_sent, gift_sent_at: gift_sent ? now : null }
              : r
          )
        );
        setSelected(new Set());
      }
    } catch {
      console.error("발송 상태 변경 실패");
    } finally {
      setUpdating(false);
    }
  };

  const handleGroupClick = (instructor: string, cohort: string) => {
    setFilterInstructor(instructor);
    setFilterCohort(cohort);
    setFilterStatus("전체");
    setSelected(new Set());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-[13px] text-muted-foreground">기프티쇼 데이터 불러오는 중...</span>
      </div>
    );
  }

  const handleAmountSubmit = async () => {
    const amount = parseInt(amountInput.replace(/\D/g, ""));
    if (isNaN(amount) || amount < 0) return;
    const ids = [...selected];
    if (ids.length === 0) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/gift-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseIds: ids, gift_amount: amount }),
      });
      if (res.ok) {
        setResponses((prev) =>
          prev.map((r) => ids.includes(r.id) ? { ...r, gift_amount: amount } : r)
        );
        setShowAmountModal(false);
        setAmountInput("");
        setSelected(new Set());
      }
    } catch {
      console.error("금액 변경 실패");
    } finally {
      setUpdating(false);
    }
  };

  const doneCount = groups.filter((g) => g.sent === g.total && g.total > 0).length;
  const inProgressCount = groups.filter((g) => g.sent > 0 && g.sent < g.total).length;
  const notStartedCount = groups.filter((g) => g.sent === 0).length;

  return (
    <div>
      {/* ===== 전체 현황 (접기/펼치기) ===== */}
      <div className="bg-card rounded-xl border mb-4">
        <button
          onClick={() => setOverviewOpen(!overviewOpen)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold">전체 현황</h3>
            <div className="flex items-center gap-1.5">
              {doneCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">완료 {doneCount}</span>}
              {inProgressCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">진행중 {inProgressCount}</span>}
              {notStartedCount > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-bold">시작 전 {notStartedCount}</span>}
            </div>
          </div>
          {overviewOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {overviewOpen && (
          <div className="px-4 pb-3">
            {/* 현황 필터 토글 */}
            <div className="flex items-center gap-1.5 mb-2">
              {([
                { status: "완료" as GroupStatus, count: doneCount, color: "emerald" },
                { status: "진행중" as GroupStatus, count: inProgressCount, color: "blue" },
                { status: "시작 전" as GroupStatus, count: notStartedCount, color: "gray" },
              ]).map(({ status, count, color }) => {
                const active = overviewFilter.has(status);
                const colorMap: Record<string, string> = {
                  emerald: active ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-muted text-muted-foreground border-transparent",
                  blue: active ? "bg-blue-100 text-blue-700 border-blue-300" : "bg-muted text-muted-foreground border-transparent",
                  gray: active ? "bg-gray-200 text-gray-700 border-gray-400" : "bg-muted text-muted-foreground border-transparent",
                };
                return (
                  <button
                    key={status}
                    onClick={(e) => { e.stopPropagation(); toggleOverviewFilter(status); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${colorMap[color]}`}
                  >
                    {status} {count}
                  </button>
                );
              })}
            </div>

            {groups.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">후기 설문 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-1">
                {filteredGroups.map((g) => {
                  const pct = g.total > 0 ? Math.round((g.sent / g.total) * 100) : 0;
                  const status = getGroupStatus(g.sent, g.total);
                  const isActive = filterInstructor === g.instructor && filterCohort === g.cohort;
                  return (
                    <button
                      key={`${g.instructor}-${g.cohort}`}
                      onClick={() => handleGroupClick(g.instructor, g.cohort)}
                      className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-left transition-all ${
                        isActive ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60"
                      }`}
                    >
                      <span className="text-[12px] font-semibold min-w-[100px] truncate">
                        {g.instructor} {g.cohort}
                      </span>
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            status === "완료" ? "bg-emerald-500" : status === "진행중" ? "bg-blue-500" : "bg-gray-300"
                          }`}
                          style={{ width: `${Math.max(pct, status === "시작 전" ? 0 : 2)}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-bold min-w-[40px] text-right ${
                        status === "완료" ? "text-emerald-600" : status === "진행중" ? "text-blue-600" : "text-muted-foreground"
                      }`}>
                        {g.sent}/{g.total}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== 필터 + 목록 ===== */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">강사:</span>
          <select
            value={filterInstructor}
            onChange={(e) => handleInstructorChange(e.target.value)}
            className="text-[12px] bg-muted px-2 py-1 rounded-lg outline-none cursor-pointer"
          >
            <option value="전체">전체</option>
            {instructors.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">기수:</span>
          <select
            value={filterCohort}
            onChange={(e) => { setFilterCohort(e.target.value); setSelected(new Set()); }}
            className="text-[12px] bg-muted px-2 py-1 rounded-lg outline-none cursor-pointer"
          >
            <option value="전체">전체</option>
            {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {(filterInstructor !== "전체" || filterCohort !== "전체") && (
          <button
            onClick={() => { setFilterInstructor("전체"); setFilterCohort("전체"); setSelected(new Set()); }}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 상태 탭 */}
      <div className="flex items-center gap-1 mb-3">
        {([
          { key: "전체" as const, count: filtered.length },
          { key: "미발송" as const, count: unsentCount },
          { key: "발송완료" as const, count: sentCount },
        ]).map(({ key, count }) => (
          <button
            key={key}
            onClick={() => { setFilterStatus(key); setSelected(new Set()); }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
              filterStatus === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {key} {count}명
          </button>
        ))}
      </div>

      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold text-muted-foreground hover:bg-accent transition-colors"
        >
          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${allSelected ? "border-primary bg-primary" : "border-gray-300"}`}>
            {allSelected && (
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          전체선택
        </button>
        <button
          onClick={handleCopy}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold text-muted-foreground hover:bg-accent transition-colors disabled:opacity-40"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
          {copied ? "복사됨!" : selected.size > 0 ? `이름/번호 복사 (${selected.size}명)` : `이름/번호 복사 (${unsentCount}명)`}
        </button>
        {selected.size > 0 && (
          <>
            <button
              onClick={() => handleGiftToggle(true)}
              disabled={updating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              발송 처리
            </button>
            <button
              onClick={() => handleGiftToggle(false)}
              disabled={updating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[12px] font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              발송 취소
            </button>
            <button
              onClick={() => { setAmountInput(""); setShowAmountModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[12px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              금액 일괄 수정
            </button>
          </>
        )}
      </div>

      {/* 테이블 */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Gift className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[14px] font-bold text-muted-foreground">후기 설문 응답이 없습니다</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="py-2 px-2 w-8"></th>
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">이름</th>
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">전화번호</th>
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">강사</th>
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">기수</th>
                <th className="py-2 px-3 text-right font-semibold text-muted-foreground">금액</th>
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground">응답일</th>
                <th className="py-2 px-3 text-center font-semibold text-muted-foreground">발송</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isSent = r.gift_sent;
                return (
                  <tr
                    key={r.id}
                    className={`border-b last:border-0 transition-colors ${
                      isSent ? "bg-muted/20 text-muted-foreground" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="py-2 px-2 text-center">
                      <button onClick={() => toggleSelect(r.id)} className="p-0.5">
                        <span className={`inline-flex w-4 h-4 rounded border-2 items-center justify-center ${
                          selected.has(r.id) ? "border-primary bg-primary" : "border-gray-300"
                        }`}>
                          {selected.has(r.id) && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className={`py-2 px-3 font-medium ${isSent ? "line-through" : ""}`}>
                      {r.name || "-"}
                    </td>
                    <td className={`py-2 px-3 ${isSent ? "line-through" : ""}`}>
                      {r.phone || "-"}
                    </td>
                    <td className="py-2 px-3">{r.instructor || "-"}</td>
                    <td className="py-2 px-3">{r.cohort || "-"}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      {r.gift_amount ? `${r.gift_amount.toLocaleString()}원` : "-"}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : "-"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isSent ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold border border-emerald-200">
                          완료
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 금액 일괄 수정 모달 */}
      {showAmountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAmountModal(false)}>
          <div className="bg-card rounded-xl shadow-xl border p-5 w-[320px]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-bold mb-3">금액 일괄 수정</h3>
            <p className="text-[12px] text-muted-foreground mb-3">
              선택된 {selected.size}명의 발송 금액을 변경합니다.
            </p>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value.replace(/\D/g, ""))}
                placeholder="금액 입력 (예: 1940)"
                className="flex-1 px-3 py-2 rounded-lg border text-[13px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleAmountSubmit(); }}
              />
              <span className="text-[13px] text-muted-foreground">원</span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAmountModal(false)}
                className="px-4 py-2 rounded-lg border text-[13px] font-bold text-muted-foreground hover:bg-accent transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAmountSubmit}
                disabled={!amountInput || updating}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {updating ? "변경 중..." : "변경"}
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [mainTab, setMainTab] = useState<"forms" | "gift">("forms");
  const [forms, setForms] = useState<SurveyForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);

  // 결과 보기 상태
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responseData, setResponseData] = useState<Record<string, { responses: FormResponse[]; count: number; total: number; loading: boolean; loadingMore: boolean }>>({});

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
      [formId]: { responses: [], count: 0, total: 0, loading: true, loadingMore: false },
    }));

    try {
      const res = await fetch(`/api/survey-forms/responses?formId=${formId}&mode=list&limit=50`);
      const data = await res.json();
      setResponseData((prev) => ({
        ...prev,
        [formId]: { responses: data.responses || [], count: data.count || 0, total: data.total || 0, loading: false, loadingMore: false },
      }));
    } catch {
      setResponseData((prev) => ({
        ...prev,
        [formId]: { responses: [], count: 0, total: 0, loading: false, loadingMore: false },
      }));
    }
  };

  const handleLoadMore = async (formId: string) => {
    const rd = responseData[formId];
    if (!rd || rd.loadingMore) return;

    setResponseData((prev) => ({
      ...prev,
      [formId]: { ...prev[formId], loadingMore: true },
    }));

    try {
      const offset = rd.responses.length;
      const res = await fetch(`/api/survey-forms/responses?formId=${formId}&mode=list&limit=50&offset=${offset}`);
      const data = await res.json();
      setResponseData((prev) => ({
        ...prev,
        [formId]: {
          ...prev[formId],
          responses: [...prev[formId].responses, ...(data.responses || [])],
          loadingMore: false,
        },
      }));
    } catch {
      setResponseData((prev) => ({
        ...prev,
        [formId]: { ...prev[formId], loadingMore: false },
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
      {/* 메인 탭 전환 */}
      <div className="flex items-center gap-1 mb-4">
        <button
          onClick={() => setMainTab("forms")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold transition-all ${
            mainTab === "forms"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          <FileText className="w-4 h-4" />
          폼 목록
        </button>
        <button
          onClick={() => setMainTab("gift")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold transition-all ${
            mainTab === "gift"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-accent"
          }`}
        >
          <Gift className="w-4 h-4" />
          기프티쇼 관리
        </button>
      </div>

      {mainTab === "gift" ? (
        <GiftManagementView />
      ) : (
      <>
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
                            총 {rd.total}명 응답
                          </span>
                          {rd.responses.length < rd.total && (
                            <span className="text-[11px] text-muted-foreground">
                              최근 {rd.responses.length}건 표시 중
                            </span>
                          )}
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

                        {/* 더보기 버튼 */}
                        {rd.responses.length < rd.total && (
                          <div className="flex justify-center mt-3">
                            <button
                              onClick={() => handleLoadMore(form.id)}
                              disabled={rd.loadingMore}
                              className="px-4 py-2 rounded-lg border text-[12px] font-semibold text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {rd.loadingMore ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  불러오는 중...
                                </>
                              ) : (
                                `${rd.total - rd.responses.length}건 더보기`
                              )}
                            </button>
                          </div>
                        )}
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
      </>
      )}
    </div>
  );
}
