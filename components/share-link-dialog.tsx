"use client";

import { useState, useEffect } from "react";
import type { ShareLink } from "@/lib/types";
import { X, Copy, Check, Trash2, Loader2, Link as LinkIcon, Pencil } from "lucide-react";
import { toast } from "sonner";

interface ShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
  platform: string;
  instructor: string;
  /** 기수 목록 (선택 필터용) */
  cohorts: string[];
}

export function ShareLinkDialog({ open, onClose, platform, instructor, cohorts }: ShareLinkDialogProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterCohort, setFilterCohort] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // 기존 링크 로드
  useEffect(() => {
    if (!open) return;
    loadLinks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/share");
      if (!res.ok) throw new Error();
      const data: ShareLink[] = await res.json();
      // 이 강사의 instructor 타입 링크만 필터
      const filtered = data.filter(
        (l) =>
          l.share_type === "instructor" &&
          l.filter_platform === platform &&
          l.filter_instructor === instructor,
      );
      setLinks(filtered);
    } catch {
      toast.error("링크 목록 로드 실패");
    } finally {
      setLoading(false);
    }
  };

  const createLink = async () => {
    setCreating(true);
    try {
      const cohortLabel = filterCohort !== "all" ? filterCohort : null;
      const titleParts = [instructor, "강사 피드백 리포트"];
      if (cohortLabel) titleParts.splice(1, 0, cohortLabel);
      const title = titleParts.join(" ");

      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          share_type: "instructor",
          filter_platform: platform,
          filter_instructor: instructor,
          filter_cohort: cohortLabel,
        }),
      });
      if (!res.ok) throw new Error();
      const newLink: ShareLink = await res.json();
      setLinks((prev) => [newLink, ...prev]);
      toast.success("공유 링크가 생성되었습니다");

      // 자동 복사
      const url = `${window.location.origin}/share/${newLink.token}`;
      await navigator.clipboard?.writeText(url);
      setCopiedId(newLink.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("링크 생성 실패");
    } finally {
      setCreating(false);
    }
  };

  const deleteLink = async (id: string) => {
    try {
      const res = await fetch("/api/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast.success("링크가 삭제되었습니다");
    } catch {
      toast.error("삭제 실패");
    }
  };

  const copyUrl = async (link: ShareLink) => {
    const url = `${window.location.origin}/share/${link.token}`;
    await navigator.clipboard?.writeText(url);
    setCopiedId(link.id);
    toast.success("URL이 복사되었습니다");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const saveTitle = async (id: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) { setEditingId(null); return; }
    try {
      const res = await fetch("/api/share", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: trimmed }),
      });
      if (!res.ok) throw new Error();
      setLinks((prev) => prev.map((l) => l.id === id ? { ...l, title: trimmed } : l));
      toast.success("제목이 수정되었습니다");
    } catch {
      toast.error("제목 수정 실패");
    }
    setEditingId(null);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-[14px] p-6 shadow-xl border w-[480px] max-h-[80vh] overflow-y-auto"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-[17px] font-extrabold">강사 공유 링크</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {instructor} 강사 전용 피드백 리포트 링크를 생성합니다
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 생성 폼 */}
        <div className="p-4 rounded-xl bg-muted/30 border mb-5">
          <div className="flex items-center gap-3">
            {cohorts.length > 1 && (
              <select
                value={filterCohort}
                onChange={(e) => setFilterCohort(e.target.value)}
                className="py-1.5 px-2.5 rounded-lg border text-[13px] bg-card flex-1"
              >
                <option value="all">전체 기수</option>
                {cohorts.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <button
              onClick={createLink}
              disabled={creating}
              className="flex items-center gap-1.5 py-2 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
            >
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LinkIcon className="w-3.5 h-3.5" />
              )}
              링크 생성
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            생성된 링크로 강사가 로그인 없이 인구통계 차트와 수강생 피드백을 확인할 수 있습니다.
            수강생 이름은 비공개됩니다.
          </p>
        </div>

        {/* 기존 링크 목록 */}
        {loading ? (
          <div className="text-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-6 text-[13px] text-muted-foreground">
            생성된 공유 링크가 없습니다
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[12px] font-semibold text-muted-foreground mb-2">
              생성된 링크 ({links.length})
            </div>
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center gap-2 p-3 rounded-lg border bg-background"
              >
                <div className="flex-1 min-w-0">
                  {editingId === link.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => saveTitle(link.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTitle(link.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="text-[13px] font-semibold w-full py-0.5 px-1.5 rounded border bg-background outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] font-semibold truncate">{link.title}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingId(link.id); setEditingTitle(link.title); }}
                        className="shrink-0 p-0.5 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
                        title="제목 수정"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    {link.filter_cohort && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">
                        {link.filter_cohort}
                      </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(link.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => copyUrl(link)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title="URL 복사"
                >
                  {copiedId === link.id ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => deleteLink(link.id)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
