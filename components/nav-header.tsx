"use client";

import { useAuth } from "@/hooks/use-auth";
import { LogOut } from "lucide-react";

export function NavHeader() {
  const { logout } = useAuth();

  return (
    <header className="py-2.5 px-5 border-b flex items-center justify-between bg-card">
      <div className="flex items-center">
        <div className="w-[26px] h-[26px] rounded-md bg-primary flex items-center justify-center text-[12px] font-black text-primary-foreground mr-2.5">
          F
        </div>
        <span className="text-[15px] font-extrabold">클래스 인사이트</span>
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
