"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle, Clock, Trash2, RefreshCw, Inbox } from "lucide-react";
import { toast } from "sonner";

interface Suggestion {
  id: string;
  content: string;
  createdAt: string;
  status: "pending" | "reviewed";
}

export function SuggestionsPanel() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suggestions");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      toast.error("건의사항 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleStatusToggle = async (s: Suggestion) => {
    const newStatus = s.status === "pending" ? "reviewed" : "pending";
    try {
      const res = await fetch("/api/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, status: newStatus }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error();
      setSuggestions((prev) =>
        prev.map((item) => (item.id === s.id ? { ...item, status: newStatus } : item))
      );
      toast.success(newStatus === "reviewed" ? "확인 처리됨" : "대기로 변경됨");
    } catch {
      toast.error("상태 변경 실패");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 건의사항을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch("/api/suggestions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error();
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      toast.success("삭제 완료");
    } catch {
      toast.error("삭제 실패");
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
        <div className="text-[13px] text-muted-foreground">건의사항 로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-bold">건의함</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            총 {suggestions.length}건 &middot; 대기 {suggestions.filter((s) => s.status === "pending").length}건
          </p>
        </div>
        <button
          onClick={fetchSuggestions}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          새로고침
        </button>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-16">
          <Inbox className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <div className="text-[14px] text-muted-foreground">아직 건의사항이 없습니다</div>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border p-4 transition-colors ${
                s.status === "reviewed" ? "bg-muted/40 border-border/60" : "bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap flex-1">{s.content}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStatusToggle(s)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      s.status === "reviewed"
                        ? "text-green-600 hover:bg-green-50"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                    title={s.status === "reviewed" ? "대기로 변경" : "확인 처리"}
                  >
                    {s.status === "reviewed" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    s.status === "reviewed"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {s.status === "reviewed" ? "확인" : "대기"}
                </span>
                <span className="text-[12px] text-muted-foreground">{formatDate(s.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
