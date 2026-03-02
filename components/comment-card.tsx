"use client";

import type { Comment } from "@/lib/types";
import { FIELD_LABELS } from "@/lib/feedback-utils";

interface CommentCardProps {
  comment: Comment;
  onToggleSentiment?: (id: string, sentiment: "positive" | "negative" | "neutral") => void;
}

const SENTIMENT_STYLES = {
  positive: {
    bg: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700",
    label: "긍정",
  },
  negative: {
    bg: "bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
    label: "부정",
  },
  neutral: {
    bg: "bg-gray-50 border-gray-200",
    badge: "bg-gray-100 text-gray-600",
    label: "중립",
  },
} as const;

const SENTIMENT_CYCLE: Record<string, "positive" | "negative" | "neutral"> = {
  positive: "negative",
  negative: "neutral",
  neutral: "positive",
};

export function CommentCard({ comment, onToggleSentiment }: CommentCardProps) {
  const sentiment = comment.sentiment || "neutral";
  const style = SENTIMENT_STYLES[sentiment];

  return (
    <div className={`p-3.5 rounded-xl border ${style.bg} transition-colors`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[12px] font-bold text-foreground/80">
              {comment.respondent}
            </span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {FIELD_LABELS[comment.source_field] || comment.source_field}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed">{comment.original_text}</p>
          {comment.ai_summary && (
            <p className="text-[11px] text-muted-foreground mt-1.5 italic">
              AI: {comment.ai_summary}
            </p>
          )}
        </div>
        <button
          onClick={() =>
            onToggleSentiment?.(comment.id, SENTIMENT_CYCLE[sentiment])
          }
          className={`shrink-0 text-[10px] px-2.5 py-1 rounded-full font-semibold cursor-pointer hover:opacity-80 transition-opacity ${style.badge}`}
        >
          {style.label}
        </button>
      </div>
    </div>
  );
}
