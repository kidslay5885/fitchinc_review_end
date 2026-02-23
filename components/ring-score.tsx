"use client";

interface RingScoreProps {
  score: number;
  max?: number;
  size?: number;
  label?: string;
}

export function RingScore({ score, max = 10, size = 50, label }: RingScoreProps) {
  const p = score / max;
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
            {score}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[10px] text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
