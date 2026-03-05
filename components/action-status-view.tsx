"use client";

import { useMemo } from "react";
import type { CommentWithAction, ActionTag } from "@/lib/types";
import {
  ACTION_TAGS,
  ACTION_TAG_ORDER,
  PROCESS_OPTIONS,
  getActionTagColor,
  getActionTagLabel,
  getProcessLabel,
  isProcessed,
} from "@/lib/action-utils";
import { FIELD_LABELS } from "@/lib/feedback-utils";
import { Star, AlertTriangle, MessageSquare, CheckCircle2 } from "lucide-react";

interface ActionStatusViewProps {
  comments: CommentWithAction[];
}

export function ActionStatusView({ comments }: ActionStatusViewProps) {
  // 역할별 통계
  const tagStats = useMemo(() => {
    const stats: Record<
      string,
      { total: number; processed: number; important: number; byStatus: Record<string, number> }
    > = {};

    for (const tag of ACTION_TAG_ORDER) {
      stats[tag] = { total: 0, processed: 0, important: 0, byStatus: {} };
    }

    for (const c of comments) {
      if (!c.action_tag) continue;
      const tag = c.action_tag;
      if (!stats[tag]) continue;
      stats[tag].total++;
      if (isProcessed(c)) {
        stats[tag].processed++;
        if (c.process_status) {
          stats[tag].byStatus[c.process_status] = (stats[tag].byStatus[c.process_status] || 0) + 1;
        }
      }
      if (c.important) stats[tag].important++;
    }

    return stats;
  }, [comments]);

  // "협의 필요" 댓글
  const needsDiscussion = useMemo(() => {
    return comments.filter((c) => c.process_status === "needs_discussion");
  }, [comments]);

  // "중요" 댓글
  const importantComments = useMemo(() => {
    return comments.filter((c) => c.important);
  }, [comments]);

  // 전체 통계
  const totalStats = useMemo(() => {
    const classified = comments.filter((c) => c.action_tag).length;
    const processed = comments.filter((c) => isProcessed(c)).length;
    const total = comments.length;
    return { total, classified, processed, unclassified: total - classified };
  }, [comments]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* 전체 현황 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="전체 댓글" value={totalStats.total} color="text-foreground" />
        <StatCard label="분류 완료" value={totalStats.classified} color="text-blue-600" />
        <StatCard label="처리 완료" value={totalStats.processed} color="text-emerald-600" />
        <StatCard label="미분류" value={totalStats.unclassified} color="text-amber-600" />
      </div>

      {/* 역할별 요약 카드 */}
      <div>
        <h2 className="text-sm font-semibold mb-3">역할별 현황</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ACTION_TAG_ORDER.map((tag) => {
            const stat = tagStats[tag];
            const info = ACTION_TAGS.find((t) => t.value === tag)!;
            const pct = stat.total > 0 ? Math.round((stat.processed / stat.total) * 100) : 0;

            return (
              <div
                key={tag}
                className={`rounded-xl border p-4 ${info.bgColor}`}
              >
                <div className="text-sm font-medium mb-1">{info.label}</div>
                <div className="text-2xl font-bold">{stat.total}</div>
                <div className="text-xs mt-1 opacity-70">
                  {stat.processed}건 처리 ({pct}%)
                </div>
                {/* 진행률 바 */}
                <div className="w-full bg-white/50 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-current h-full rounded-full transition-all opacity-50"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {stat.important > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    중요 {stat.important}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 처리 상태별 분포 */}
      <div>
        <h2 className="text-sm font-semibold mb-3">처리 상태별 분포</h2>
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2 font-medium">역할</th>
                {PROCESS_OPTIONS.map((opt) => (
                  <th key={opt.value} className="text-center px-3 py-2 font-medium">
                    {opt.label}
                  </th>
                ))}
                <th className="text-center px-3 py-2 font-medium">미처리</th>
                <th className="text-center px-3 py-2 font-medium">합계</th>
              </tr>
            </thead>
            <tbody>
              {ACTION_TAG_ORDER.filter((tag) => tag !== "no_action").map((tag) => {
                const stat = tagStats[tag];
                const info = ACTION_TAGS.find((t) => t.value === tag)!;
                const unprocessed = stat.total - stat.processed;

                return (
                  <tr key={tag} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${info.bgColor}`}>
                        {info.label}
                      </span>
                    </td>
                    {PROCESS_OPTIONS.map((opt) => (
                      <td key={opt.value} className="text-center px-3 py-2.5 text-muted-foreground">
                        {stat.byStatus[opt.value] || 0}
                      </td>
                    ))}
                    <td className="text-center px-3 py-2.5 font-medium">
                      {unprocessed > 0 ? (
                        <span className="text-amber-600">{unprocessed}</span>
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      )}
                    </td>
                    <td className="text-center px-3 py-2.5 font-medium">{stat.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* "협의 필요" 패널 */}
      {needsDiscussion.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-600" />
            협의 필요 ({needsDiscussion.length}건)
          </h2>
          <div className="rounded-xl border bg-card divide-y max-h-[400px] overflow-y-auto">
            {needsDiscussion.map((c) => (
              <div key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${getActionTagColor(c.action_tag)}`}>
                    {getActionTagLabel(c.action_tag)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{c.original_text}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{c._instructor} · {c._course} {c._cohort}</span>
                    </div>
                    {c.process_memo && (
                      <div className="mt-1.5 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        메모: {c.process_memo}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* "중요" 패널 */}
      {importantComments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            중요 표시 ({importantComments.length}건)
          </h2>
          <div className="rounded-xl border bg-card divide-y max-h-[400px] overflow-y-auto">
            {importantComments.map((c) => (
              <div key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${getActionTagColor(c.action_tag)}`}>
                    {getActionTagLabel(c.action_tag)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{c.original_text}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{c._instructor} · {c._course} {c._cohort}</span>
                      {c.process_status && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-muted">
                          {getProcessLabel(c.process_status)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 통계 카드 =====

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
