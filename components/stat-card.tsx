"use client";

import React from "react";

interface StatCardProps {
  label: string;
  desc: string;
  num: string;
  src: string;
}

export const StatCard = React.memo(function StatCard({ label, desc, num, src }: StatCardProps) {
  return (
    <div className="bg-card rounded-[10px] border p-4 border-l-[3px] border-l-primary">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[11px] font-bold text-muted-foreground mb-1">{label}</div>
          <div className="text-[13px] text-muted-foreground">{desc}</div>
        </div>
        <div className="text-[28px] font-extrabold text-primary leading-none">{num}</div>
      </div>
      <div className="text-[10px] text-muted-foreground mt-2">📎 {src}</div>
    </div>
  );
});
