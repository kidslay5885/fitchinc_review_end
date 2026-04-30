"use client";

import { useState, useEffect, useMemo } from "react";
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
  UserSearch,
  ChevronRight,
  CheckCircle2,
  Undo2,
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
              {field.type === "scale" && (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <input
                    type="number"
                    value={field.scaleMin ?? 1}
                    onChange={(e) => updateField(field.key, { scaleMin: parseInt(e.target.value) || 1 })}
                    className="w-8 text-[10px] text-center bg-muted px-0.5 py-0.5 rounded outline-none"
                    min={0}
                  />
                  <span className="text-[10px] text-muted-foreground">~</span>
                  <input
                    type="number"
                    value={field.scaleMax ?? 10}
                    onChange={(e) => updateField(field.key, { scaleMax: parseInt(e.target.value) || 5 })}
                    className="w-8 text-[10px] text-center bg-muted px-0.5 py-0.5 rounded outline-none"
                    min={1}
                  />
                  <span className="text-[10px] text-muted-foreground">점</span>
                </div>
              )}
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

// ===== 명단 매칭 뷰 =====

interface MatchResult {
  responseId: string;
  currentName: string;
  matchedName: string;
  phone: string;
}

function NameMatchView() {
  const [pasteText, setPasteText] = useState("");
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalChecked, setTotalChecked] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const parsePastedData = (text: string): { name: string; phone: string }[] => {
    const lines = text.trim().split("\n").filter(Boolean);
    const entries: { name: string; phone: string }[] = [];
    for (const line of lines) {
      const parts = line.split("\t").map((s) => s.trim());
      if (parts.length < 2) continue;
      // 이름 + 전화번호 (순서 자동 감지)
      const phoneIdx = parts.findIndex((p) => /^0\d{1,2}[\s-]?\d{3,4}[\s-]?\d{4}$/.test(p.replace(/\D/g, "").length >= 10 ? p : ""));
      if (phoneIdx === -1) {
        // 숫자가 10자리 이상인 컬럼을 전화번호로
        const numIdx = parts.findIndex((p) => p.replace(/\D/g, "").length >= 10);
        if (numIdx === -1) continue;
        const nameIdx = numIdx === 0 ? 1 : 0;
        entries.push({ name: parts[nameIdx], phone: parts[numIdx] });
      } else {
        const nameIdx = phoneIdx === 0 ? 1 : 0;
        entries.push({ name: parts[nameIdx], phone: parts[phoneIdx] });
      }
    }
    return entries;
  };

  const handleMatch = async () => {
    const entries = parsePastedData(pasteText);
    if (entries.length === 0) return;
    setLoading(true);
    setSearched(false);
    try {
      const res = await fetch("/api/match-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (res.ok) {
        const { matches: m, totalChecked: tc } = await res.json();
        setMatches(m);
        setTotalChecked(tc || 0);
        setSelected(new Set(m.map((r: MatchResult) => r.responseId)));
        setSearched(true);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    const updates = matches
      .filter((m) => selected.has(m.responseId))
      .map((m) => ({ responseId: m.responseId, name: m.matchedName }));
    if (updates.length === 0) return;
    setApplying(true);
    try {
      const res = await fetch("/api/match-names", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (res.ok) {
        const { updated } = await res.json();
        // 적용된 항목 제거
        setMatches((prev) => prev.filter((m) => !selected.has(m.responseId)));
        setSelected(new Set());
        alert(`${updated}건 이름 업데이트 완료`);
      }
    } catch {
      /* ignore */
    } finally {
      setApplying(false);
    }
  };

  const parsedCount = parsePastedData(pasteText).length;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-[13px] text-blue-700">
        <p className="font-bold mb-1">사용법</p>
        <p>구글 시트에서 <strong>이름 + 전화번호</strong> 컬럼을 복사해서 아래에 붙여넣기 하세요.</p>
        <p className="mt-1">설문 응답자 중 전화번호가 일치하는데 이름이 다르거나 비어있는 경우를 찾아줍니다.</p>
      </div>

      <div>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"홍길동\t010-1234-5678\n김철수\t010-5678-1234\n..."}
          className="w-full h-40 border rounded-xl p-3 text-[13px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[12px] text-muted-foreground">
            {parsedCount > 0 ? `${parsedCount}명 인식됨` : "데이터를 붙여넣기 하세요"}
          </span>
          <button
            onClick={handleMatch}
            disabled={parsedCount === 0 || loading}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserSearch className="w-3.5 h-3.5" />}
            매칭 검색
          </button>
        </div>
      </div>

      {/* 매칭 결과 */}
      {matches.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b">
            <span className="text-[13px] font-bold">{matches.length}건 매칭됨</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === matches.length}
                  onChange={() => {
                    if (selected.size === matches.length) setSelected(new Set());
                    else setSelected(new Set(matches.map((m) => m.responseId)));
                  }}
                  className="rounded"
                />
                전체 선택
              </label>
              <button
                onClick={handleApply}
                disabled={selected.size === 0 || applying}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1"
              >
                {applying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                선택 적용 ({selected.size}건)
              </button>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y">
            {matches.map((m) => (
              <div key={m.responseId} className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={selected.has(m.responseId)}
                  onChange={() => {
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(m.responseId)) next.delete(m.responseId);
                      else next.add(m.responseId);
                      return next;
                    });
                  }}
                  className="rounded"
                />
                <span className="text-muted-foreground font-mono text-[12px] min-w-[110px]">{m.phone}</span>
                <span className="text-red-400 line-through min-w-[60px]">{m.currentName || "(없음)"}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-bold text-primary">{m.matchedName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {matches.length === 0 && !loading && pasteText && parsedCount > 0 && (
        <div className="text-center py-8 text-muted-foreground text-[14px]">
          {searched
            ? <><p className="font-bold">매칭할 대상이 없습니다</p><p className="text-[12px] mt-1">응답 {totalChecked}건 확인 — 이름이 모두 일치하거나 전화번호가 일치하는 응답이 없습니다</p></>
            : "매칭 검색 버튼을 눌러주세요"
          }
        </div>
      )}
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
  const [giftSubTab, setGiftSubTab] = useState<"gift" | "match">("gift");
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<GiftResponse[]>([]);
  const [updating, setUpdating] = useState(false);
  const [copiedGroup, setCopiedGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showSent, setShowSent] = useState(false);

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

  // 강사+기수별 그룹
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; instructor: string; cohort: string; responses: GiftResponse[]; sent: number }>();
    for (const r of responses) {
      const key = `${r.instructor}||${r.cohort}`;
      if (!map.has(key)) map.set(key, { key, instructor: r.instructor, cohort: r.cohort, responses: [], sent: 0 });
      const g = map.get(key)!;
      g.responses.push(r);
      if (r.gift_sent) g.sent++;
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.instructor !== b.instructor) return a.instructor.localeCompare(b.instructor, "ko");
      return a.cohort.localeCompare(b.cohort, "ko");
    });
  }, [responses]);

  const unsentGroups = groups.filter((g) => g.sent < g.responses.length);
  const sentGroups = groups.filter((g) => g.sent === g.responses.length && g.responses.length > 0);

  const totalAll = responses.length;
  const sentAll = responses.filter((r) => r.gift_sent).length;

  // 미발송 카드는 기본 펼침
  useEffect(() => {
    setExpandedGroups(new Set(unsentGroups.map((g) => g.key)));
  }, [responses]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleCopyGroup = (group: typeof groups[0]) => {
    const targets = group.responses.filter((r) => !r.gift_sent);
    if (targets.length === 0) return;
    const text = targets.map((r) => `${r.name}\t${r.phone || ""}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedGroup(group.key);
    setTimeout(() => setCopiedGroup(null), 2000);
  };

  const handleSendGroup = async (group: typeof groups[0]) => {
    const ids = group.responses.filter((r) => !r.gift_sent).map((r) => r.id);
    if (ids.length === 0) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/gift-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseIds: ids, gift_sent: true }),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setResponses((prev) =>
          prev.map((r) => ids.includes(r.id) ? { ...r, gift_sent: true, gift_sent_at: now } : r)
        );
      }
    } catch {
      console.error("발송 상태 변경 실패");
    } finally {
      setUpdating(false);
    }
  };

  const handleUndoGroup = async (group: typeof groups[0]) => {
    const ids = group.responses.filter((r) => r.gift_sent).map((r) => r.id);
    if (ids.length === 0) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/gift-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseIds: ids, gift_sent: false }),
      });
      if (res.ok) {
        setResponses((prev) =>
          prev.map((r) => ids.includes(r.id) ? { ...r, gift_sent: false, gift_sent_at: null } : r)
        );
      }
    } catch {
      console.error("발송 취소 실패");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-[13px] text-muted-foreground">데이터 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div>
      {/* 서브탭: 발송 관리 / 명단 매칭 */}
      <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border mb-4 w-fit">
        <button onClick={() => setGiftSubTab("gift")} className={`py-1.5 px-3 rounded-md text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${giftSubTab === "gift" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <Gift className="w-3.5 h-3.5" />발송 관리
        </button>
        <button onClick={() => setGiftSubTab("match")} className={`py-1.5 px-3 rounded-md text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${giftSubTab === "match" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          <UserSearch className="w-3.5 h-3.5" />명단 매칭
        </button>
      </div>

      {giftSubTab === "match" ? (
        <NameMatchView />
      ) : (
      <>
      {/* 요약 */}
      <div className="flex items-center gap-3 mb-4 text-[13px]">
        <span className="text-muted-foreground">전체 <strong className="text-foreground">{totalAll}명</strong></span>
        <span className="text-muted-foreground">발송 완료 <strong className="text-emerald-600">{sentAll}명</strong></span>
        <span className="text-muted-foreground">미발송 <strong className="text-foreground">{totalAll - sentAll}명</strong></span>
      </div>

      {/* 미발송 그룹 카드 */}
      {unsentGroups.length === 0 && sentGroups.length === 0 && (
        <div className="text-center py-12">
          <Gift className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[14px] font-bold text-muted-foreground">후기 설문 응답이 없습니다</p>
        </div>
      )}

      {unsentGroups.length > 0 && (
        <div className="space-y-3 mb-6">
          {unsentGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.key);
            const isCopied = copiedGroup === group.key;
            const unsent = group.responses.filter((r) => !r.gift_sent);
            const sentInGroup = group.responses.filter((r) => r.gift_sent);
            return (
              <div key={group.key} className="bg-card rounded-xl border overflow-hidden">
                {/* 카드 헤더 */}
                <button
                  onClick={() => toggleExpand(group.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  <span className="text-[14px] font-bold">{group.instructor}</span>
                  <span className="text-[12px] bg-muted px-2 py-0.5 rounded-lg font-semibold text-muted-foreground">{group.cohort}</span>
                  <span className="text-[13px] text-muted-foreground">{unsent.length}명 미발송</span>
                  {sentInGroup.length > 0 && (
                    <span className="text-[11px] text-emerald-600 font-semibold">{sentInGroup.length}명 완료</span>
                  )}
                </button>

                {/* 명단 */}
                {isExpanded && (
                  <div className="border-t">
                    <div className="divide-y">
                      {unsent.map((r) => (
                        <div key={r.id} className="flex items-center gap-4 px-5 py-2 text-[13px]">
                          <span className="font-medium min-w-[60px]">{r.name || "-"}</span>
                          <span className="text-muted-foreground font-mono">{r.phone || "-"}</span>
                        </div>
                      ))}
                    </div>
                    {/* 카드 액션 */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-t">
                      <button
                        onClick={() => handleCopyGroup(group)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold hover:bg-accent transition-colors"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                        {isCopied ? "복사됨!" : `이름/번호 복사 (${unsent.length}명)`}
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => handleSendGroup(group)}
                        disabled={updating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[12px] font-bold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        발송 완료 처리
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 발송 완료 그룹 */}
      {sentGroups.length > 0 && (
        <div>
          <button
            onClick={() => setShowSent(!showSent)}
            className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            {showSent ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            발송 완료 ({sentGroups.length}개 그룹, {sentAll}명)
          </button>

          {showSent && (
            <div className="space-y-2">
              {sentGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.key);
                const sentDate = group.responses.find((r) => r.gift_sent_at)?.gift_sent_at;
                return (
                  <div key={group.key} className="bg-muted/30 rounded-xl border overflow-hidden">
                    <button
                      onClick={() => toggleExpand(group.key)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-[13px] font-bold">{group.instructor}</span>
                      <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-semibold text-muted-foreground">{group.cohort}</span>
                      <span className="text-[12px] text-muted-foreground">{group.responses.length}명</span>
                      {sentDate && (
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          {new Date(sentDate).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} 발송
                        </span>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t">
                        <div className="divide-y">
                          {group.responses.map((r) => (
                            <div key={r.id} className="flex items-center gap-4 px-5 py-1.5 text-[12px] text-muted-foreground">
                              <span className="min-w-[60px]">{r.name || "-"}</span>
                              <span className="font-mono">{r.phone || "-"}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-muted/20 border-t">
                          <button
                            onClick={() => handleUndoGroup(group)}
                            disabled={updating}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50"
                          >
                            <Undo2 className="w-3 h-3" />발송 취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </>
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
