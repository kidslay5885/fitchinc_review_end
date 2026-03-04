"use client";

import { useAuth } from "@/hooks/use-auth";
import { LogOut, BarChart3, MessageSquare, FileText } from "lucide-react";

type AppMode = "landing" | "data" | "role" | "classify" | "form";

interface NavHeaderProps {
  onHome?: () => void;
  appMode?: AppMode;
  onChangeMode?: (mode: AppMode) => void;
}

const MODE_TABS: { mode: AppMode; label: string; icon: React.ReactNode }[] = [
  { mode: "data", label: "전체 설문 정보", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { mode: "role", label: "직무별 피드백", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { mode: "form", label: "설문 폼 관리", icon: <FileText className="w-3.5 h-3.5" /> },
];

export function NavHeader({ onHome, appMode, onChangeMode }: NavHeaderProps) {
  const { logout } = useAuth();
  const showTabs = appMode && appMode !== "landing" && onChangeMode;

  return (
    <header className="py-2.5 px-5 border-b flex items-center justify-between bg-card">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <img src="/fitchnic-logo.png" alt="핏크닉" className="h-[22px] w-auto" />
          <span className="text-[16px] font-extrabold">클래스 인사이트</span>
        </button>

        {showTabs && (
          <nav className="flex items-center gap-0.5 ml-3 bg-muted rounded-lg p-0.5 border">
            {MODE_TABS.map((tab) => (
              <button
                key={tab.mode}
                type="button"
                onClick={() => onChangeMode(tab.mode)}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md text-[13px] font-semibold transition-colors ${
                  appMode === tab.mode
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
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
