"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Gift, Loader2, Search, ChevronDown, ChevronRight,
  Check, ClipboardCopy, Undo2, Calendar, Coffee,
  ExternalLink, LogOut, Users, Clock, UserCheck,
} from "lucide-react";

/* ── Types ── */
interface GiftRow {
  id: string;
  name: string;
  phone: string;
  gift_sent: boolean;
  gift_sent_at: string | null;
  created_at: string;
  instructor: string;
  cohort: string;
  course: string;
  platform: string;
}

interface Stats {
  total: number;
  sent: number;
  pending: number;
}

type Tab = "status" | "date" | "instructor";

/* ── Helpers ── */
function fmtDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return `${m}/${day}(${weekdays[d.getDay()]})`;
}

function fmtDateFull(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function copyToClipboard(rows: GiftRow[]) {
  const text = rows.map((r) => `${r.name}\t${r.phone || ""}`).join("\n");
  navigator.clipboard.writeText(text);
}

/* ── Main Page ── */
export default function GiftPage() {
  const router = useRouter();
  const [data, setData] = useState<GiftRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, sent: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("status");
  const [search, setSearch] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [groupDates, setGroupDates] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  /* ── Fetch data ── */
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/gift-dashboard");
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setData(json.responses || []);
      setStats(json.stats || { total: 0, sent: 0, pending: 0 });
    } catch (e) {
      console.error("gift-dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Filtered data ── */
  const filtered = useMemo(() => {
    let rows = data;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) => r.name.toLowerCase().includes(q) || r.instructor.toLowerCase().includes(q),
      );
    }
    if (instructorFilter) {
      rows = rows.filter((r) => r.instructor === instructorFilter);
    }
    return rows;
  }, [data, search, instructorFilter]);

  const instructors = useMemo(
    () => [...new Set(data.map((r) => r.instructor))].sort(),
    [data],
  );

  /* ── Toggle expand ── */
  const toggle = (key: string) =>
    setExpanded((p) => ({ ...p, [key]: !p[key] }));

  /* ── Send gift ── */
  const handleSend = async (ids: string[], groupKey: string) => {
    const date = groupDates[groupKey] || todayStr();
    setUpdating(groupKey);
    try {
      const res = await fetch("/api/gift-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseIds: ids,
          gift_sent: true,
          gift_sent_at: new Date(date + "T00:00:00").toISOString(),
        }),
      });
      if (res.ok) {
        const sentAt = new Date(date + "T00:00:00").toISOString();
        setData((prev) =>
          prev.map((r) =>
            ids.includes(r.id) ? { ...r, gift_sent: true, gift_sent_at: sentAt } : r,
          ),
        );
        setStats((p) => ({ ...p, sent: p.sent + ids.length, pending: p.pending - ids.length }));
      }
    } catch (e) {
      console.error("send error:", e);
    } finally {
      setUpdating(null);
    }
  };

  /* ── Undo gift ── */
  const handleUndo = async (ids: string[], groupKey: string) => {
    setUpdating(groupKey);
    try {
      const res = await fetch("/api/gift-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseIds: ids, gift_sent: false }),
      });
      if (res.ok) {
        setData((prev) =>
          prev.map((r) =>
            ids.includes(r.id) ? { ...r, gift_sent: false, gift_sent_at: null } : r,
          ),
        );
        setStats((p) => ({ ...p, sent: p.sent - ids.length, pending: p.pending + ids.length }));
      }
    } catch (e) {
      console.error("undo error:", e);
    } finally {
      setUpdating(null);
    }
  };

  /* ── Copy with feedback ── */
  const handleCopy = (rows: GiftRow[], key: string) => {
    copyToClipboard(rows);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  /* ── Logout ── */
  const handleLogout = () => {
    document.cookie = "ci_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-amber-600" />
            <span className="font-bold text-sm sm:text-base">핏크닉 기프티쇼 관리</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted"
            >
              클래스 인사이트
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard icon={Users} label="전체" value={stats.total} color="text-foreground" bg="bg-muted/50" />
          <StatCard icon={Clock} label="발송 필요" value={stats.pending} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-950/20" />
          <StatCard icon={UserCheck} label="발송 완료" value={stats.sent} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/20" />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
          {([
            ["status", "상태별"],
            ["date", "발송일별"],
            ["instructor", "강사별"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Search + Filter ── */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 또는 강사 검색..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={instructorFilter}
            onChange={(e) => setInstructorFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background text-sm min-w-[140px]"
          >
            <option value="">전체 강사</option>
            {instructors.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </div>

        {/* ── Tab Content ── */}
        {tab === "status" && (
          <StatusView
            rows={filtered}
            expanded={expanded}
            toggle={toggle}
            groupDates={groupDates}
            setGroupDates={setGroupDates}
            updating={updating}
            onSend={handleSend}
            onUndo={handleUndo}
            onCopy={handleCopy}
            copied={copied}
          />
        )}
        {tab === "date" && (
          <DateView
            rows={filtered}
            expanded={expanded}
            toggle={toggle}
            onCopy={handleCopy}
            copied={copied}
          />
        )}
        {tab === "instructor" && (
          <InstructorView
            rows={filtered}
            expanded={expanded}
            toggle={toggle}
          />
        )}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════ */

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: typeof Users; label: string; value: number; color: string; bg: string;
}) {
  return (
    <div className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
      <div className={`${color} p-2 rounded-lg bg-background/60`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl font-bold ${color}`}>{value}명</div>
      </div>
    </div>
  );
}

/* ── Person row ── */
function PersonRow({ r }: { r: GiftRow }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 text-sm">
      <span>{r.name}</span>
      <span className="text-muted-foreground text-xs font-mono">{r.phone || "-"}</span>
    </div>
  );
}

/* ── TAB 1: Status View ── */
function StatusView({ rows, expanded, toggle, groupDates, setGroupDates, updating, onSend, onUndo, onCopy, copied }: {
  rows: GiftRow[];
  expanded: Record<string, boolean>;
  toggle: (k: string) => void;
  groupDates: Record<string, string>;
  setGroupDates: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  updating: string | null;
  onSend: (ids: string[], key: string) => void;
  onUndo: (ids: string[], key: string) => void;
  onCopy: (rows: GiftRow[], key: string) => void;
  copied: string | null;
}) {
  const pending = rows.filter((r) => !r.gift_sent);
  const sent = rows.filter((r) => r.gift_sent);

  const pendingGroups = groupByInstructorCohort(pending);
  const sentGroups = groupByInstructorCohort(sent);
  const [showSent, setShowSent] = useState(false);

  return (
    <div className="space-y-4">
      {/* Pending */}
      {pendingGroups.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-amber-600 mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            발송 필요 ({pending.length}명)
          </h3>
          <div className="space-y-2">
            {pendingGroups.map((g) => {
              const key = `pending-${g.key}`;
              const isOpen = expanded[key] !== false; // default open
              return (
                <div key={key} className="border rounded-xl overflow-hidden bg-card">
                  <button
                    onClick={() => toggle(key)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span>{g.instructor}</span>
                      <span className="text-muted-foreground">{g.cohort}</span>
                      <span className="text-amber-600 text-xs ml-1">— {g.rows.length}명 미발송</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div>
                      <div className="divide-y border-t">
                        {g.rows.map((r) => <PersonRow key={r.id} r={r} />)}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t bg-muted/20">
                        <button
                          onClick={() => onCopy(g.rows, key)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border hover:bg-muted transition-colors min-h-[36px]"
                        >
                          {copied === key ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                          {copied === key ? "복사됨" : `이름/번호 복사 (${g.rows.length}명)`}
                        </button>
                        <input
                          type="date"
                          value={groupDates[g.key] || todayStr()}
                          onChange={(e) => setGroupDates((p) => ({ ...p, [g.key]: e.target.value }))}
                          className="text-xs px-2.5 py-1.5 rounded-md border bg-background min-h-[36px]"
                        />
                        <button
                          onClick={() => onSend(g.rows.map((r) => r.id), g.key)}
                          disabled={updating === g.key}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors min-h-[36px]"
                        >
                          {updating === g.key ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Gift className="w-3.5 h-3.5" />
                          )}
                          발송 완료 처리
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Sent toggle */}
      {sentGroups.length > 0 && (
        <section>
          <button
            onClick={() => setShowSent((p) => !p)}
            className="text-sm font-semibold text-emerald-600 mb-2 flex items-center gap-1.5 hover:underline"
          >
            {showSent ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <UserCheck className="w-4 h-4" />
            발송 완료 ({sent.length}명)
          </button>
          {showSent && (
            <div className="space-y-2">
              {sentGroups.map((g) => {
                const key = `sent-${g.key}`;
                const isOpen = expanded[key] ?? false;
                const sentDate = g.rows[0]?.gift_sent_at;
                return (
                  <div key={key} className="border rounded-xl overflow-hidden bg-card">
                    <button
                      onClick={() => toggle(key)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span>{g.instructor}</span>
                        <span className="text-muted-foreground">{g.cohort}</span>
                        <span className="text-emerald-600 text-xs ml-1">— {g.rows.length}명 완료</span>
                        {sentDate && <span className="text-muted-foreground text-xs">{fmtDate(sentDate)}</span>}
                      </div>
                    </button>
                    {isOpen && (
                      <div>
                        <div className="divide-y border-t">
                          {g.rows.map((r) => <PersonRow key={r.id} r={r} />)}
                        </div>
                        <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/20">
                          <button
                            onClick={() => onUndo(g.rows.map((r) => r.id), g.key)}
                            disabled={updating === g.key}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 transition-colors min-h-[36px]"
                          >
                            {updating === g.key ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Undo2 className="w-3.5 h-3.5" />
                            )}
                            발송 취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {pendingGroups.length === 0 && sentGroups.length === 0 && (
        <EmptyState />
      )}
    </div>
  );
}

/* ── TAB 2: Date View ── */
function DateView({ rows, expanded, toggle, onCopy, copied }: {
  rows: GiftRow[];
  expanded: Record<string, boolean>;
  toggle: (k: string) => void;
  onCopy: (rows: GiftRow[], key: string) => void;
  copied: string | null;
}) {
  // Group by date (sent_at date or "미발송")
  const groups = useMemo(() => {
    const dateMap: Record<string, GiftRow[]> = {};
    for (const r of rows) {
      const dateKey = r.gift_sent && r.gift_sent_at ? fmtDateFull(r.gift_sent_at) : "__pending";
      if (!dateMap[dateKey]) dateMap[dateKey] = [];
      dateMap[dateKey].push(r);
    }
    // Sort: dates descending, pending last
    const keys = Object.keys(dateMap).sort((a, b) => {
      if (a === "__pending") return 1;
      if (b === "__pending") return -1;
      return b.localeCompare(a);
    });
    return keys.map((k) => ({ dateKey: k, rows: dateMap[k] }));
  }, [rows]);

  return (
    <div className="space-y-4">
      {groups.map(({ dateKey, rows: dateRows }) => {
        const isPending = dateKey === "__pending";
        const label = isPending ? "미발송" : fmtDate(dateRows[0]?.gift_sent_at);
        const groupKey = `date-${dateKey}`;
        const isOpen = expanded[groupKey] !== false;

        // Sub-group by instructor+cohort
        const subGroups = groupByInstructorCohort(dateRows);

        return (
          <div key={groupKey} className="border rounded-xl overflow-hidden bg-card">
            <button
              onClick={() => toggle(groupKey)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {isPending ? (
                  <Clock className="w-4 h-4 text-amber-600" />
                ) : (
                  <Calendar className="w-4 h-4 text-emerald-600" />
                )}
                <span className={isPending ? "text-amber-600" : ""}>{label}</span>
                <span className="text-muted-foreground text-xs">— {dateRows.length}명</span>
              </div>
              {!isPending && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onCopy(dateRows, groupKey); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onCopy(dateRows, groupKey); } }}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border hover:bg-muted transition-colors cursor-pointer"
                >
                  {copied === groupKey ? <Check className="w-3 h-3 text-emerald-600" /> : <ClipboardCopy className="w-3 h-3" />}
                  {copied === groupKey ? "복사됨" : "전체 복사"}
                </span>
              )}
            </button>
            {isOpen && (
              <div className="divide-y border-t">
                {subGroups.map((sg) => (
                  <div key={sg.key} className="px-4 py-2.5">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className="font-medium">{sg.instructor}</span>
                      <span className="text-muted-foreground">{sg.cohort}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {sg.rows.map((r) => r.name).join(", ")}
                      {sg.rows.length > 5 && ` 외 ${sg.rows.length - 5}명`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {groups.length === 0 && <EmptyState />}
    </div>
  );
}

/* ── TAB 3: Instructor View ── */
function InstructorView({ rows, expanded, toggle }: {
  rows: GiftRow[];
  expanded: Record<string, boolean>;
  toggle: (k: string) => void;
}) {
  const groups = useMemo(() => {
    const map: Record<string, GiftRow[]> = {};
    for (const r of rows) {
      if (!map[r.instructor]) map[r.instructor] = [];
      map[r.instructor].push(r);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([instructor, instrRows]) => {
        // Sub-group by cohort
        const cohortMap: Record<string, GiftRow[]> = {};
        for (const r of instrRows) {
          const ck = r.cohort || "(미지정)";
          if (!cohortMap[ck]) cohortMap[ck] = [];
          cohortMap[ck].push(r);
        }
        const cohorts = Object.entries(cohortMap).sort(([a], [b]) => a.localeCompare(b)).map(([cohort, cRows]) => {
          const sent = cRows.filter((r) => r.gift_sent).length;
          const sentDate = cRows.find((r) => r.gift_sent)?.gift_sent_at;
          return { cohort, rows: cRows, sent, total: cRows.length, sentDate };
        });
        const totalSent = instrRows.filter((r) => r.gift_sent).length;
        return { instructor, cohorts, total: instrRows.length, sent: totalSent };
      });
  }, [rows]);

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const key = `instr-${g.instructor}`;
        const isOpen = expanded[key] !== false;
        const allDone = g.sent === g.total;

        return (
          <div key={key} className="border rounded-xl overflow-hidden bg-card">
            <button
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <span>{g.instructor}</span>
                <span className={`text-xs ${allDone ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {g.sent}/{g.total}
                </span>
                {allDone && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
              {/* Progress bar */}
              <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${g.total > 0 ? (g.sent / g.total) * 100 : 0}%` }}
                />
              </div>
            </button>
            {isOpen && (
              <div className="divide-y border-t">
                {g.cohorts.map((c) => {
                  const cohortDone = c.sent === c.total;
                  const pendingCount = c.total - c.sent;
                  return (
                    <div key={c.cohort} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.cohort}</span>
                        <span className={`text-xs ${cohortDone ? "text-emerald-600" : "text-muted-foreground"}`}>
                          ({c.sent}/{c.total})
                        </span>
                        {cohortDone && <Check className="w-3 h-3 text-emerald-600" />}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {cohortDone && c.sentDate
                          ? fmtDate(c.sentDate) + " 발송"
                          : pendingCount > 0
                            ? `${pendingCount}명 미발송`
                            : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {groups.length === 0 && <EmptyState />}
    </div>
  );
}

/* ── Empty state ── */
function EmptyState() {
  return (
    <div className="text-center py-12 text-muted-foreground text-sm">
      <Gift className="w-8 h-8 mx-auto mb-2 opacity-40" />
      데이터가 없습니다
    </div>
  );
}

/* ── Group helper ── */
function groupByInstructorCohort(rows: GiftRow[]) {
  const map: Record<string, GiftRow[]> = {};
  for (const r of rows) {
    const k = `${r.instructor}||${r.cohort}`;
    if (!map[k]) map[k] = [];
    map[k].push(r);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => ({
      key,
      instructor: rows[0].instructor,
      cohort: rows[0].cohort || "(미지정)",
      rows,
    }));
}
