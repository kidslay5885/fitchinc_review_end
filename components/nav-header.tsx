"use client";

import { useAuth } from "@/hooks/use-auth";
import { LogOut, ChevronLeft } from "lucide-react";

interface NavHeaderProps {
  onHome?: () => void;
  pageTitle?: string;
}

export function NavHeader({ onHome, pageTitle }: NavHeaderProps) {
  const { logout } = useAuth();

  return (
    <header className="py-2.5 px-5 border-b flex items-center justify-between bg-card">
      <div className="flex items-center gap-2">
        {onHome && (
          <button
            onClick={onHome}
            className="flex items-center gap-0.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors mr-1"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            홈
          </button>
        )}
        <img src="/fitchnic-logo.png" alt="핏크닉" className="h-[22px] w-auto mr-2.5" />
        <span className="text-[16px] font-extrabold">클래스 인사이트</span>
        {pageTitle && (
          <>
            <span className="text-[14px] text-muted-foreground/60 font-medium">·</span>
            <span className="text-[14px] font-semibold text-muted-foreground">{pageTitle}</span>
          </>
        )}
      </div>

      <button
        onClick={logout}
        className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" />
        로그아웃
      </button>
    </header>
  );
}
