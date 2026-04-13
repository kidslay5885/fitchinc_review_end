"use client";

import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RingScoreProps {
  score: number;
  max?: number;
  size?: number;
  label?: string;
  title?: string;
  excluded?: boolean;
}

function RingScoreContent({
  score,
  max = 10,
  size = 50,
  label,
  excluded,
}: Omit<RingScoreProps, "title">) {
  if (excluded) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative flex items-center justify-center rounded-full border-2 border-dashed border-muted" style={{ width: size, height: size }}>
          <span className="text-[10px] font-semibold text-muted-foreground">제외</span>
        </div>
        {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
      </div>
    );
  }

  const p = Math.min(1, score / max);
  const r = (size - 7) / 2;
  const ci = Math.PI * 2 * r;
  const color = p >= 0.9 ? "#1A8754" : p >= 0.7 ? "#3451B2" : "#B45309";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={4.5}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={4.5}
            strokeDasharray={`${p * ci} ${ci}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-extrabold" style={{ color }}>
            {String(score)}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[10px] text-muted-foreground">{label}</span>
      )}
    </div>
  );
}

export const RingScore = React.memo(function RingScore({ score, max = 10, size = 50, label, title, excluded }: RingScoreProps) {
  const defaultTitle =
    label === "커리큘럼"
      ? "후기 설문의 커리큘럼 만족도 평균 점수입니다. (10점 만점)"
      : label === "피드백"
        ? "후기 설문의 강사 피드백 만족도 평균 점수입니다. (10점 만점)"
        : undefined;
  const tooltipText = title ?? defaultTitle ?? (excluded ? "폼 항목 차이로 측정되지 않아 해당 항목은 제외되었습니다." : undefined);

  const content = <RingScoreContent score={score} max={max} size={size} label={label} excluded={excluded} />;

  if (!tooltipText) {
    return content;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div className="cursor-help inline-flex flex-col items-center">{content}</div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px]">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
});
