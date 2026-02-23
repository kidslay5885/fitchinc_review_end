"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "로그인 실패");
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-2xl border p-8 shadow-sm">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-sm font-black text-primary-foreground">
              F
            </div>
            <span className="text-lg font-extrabold">클래스 인사이트</span>
          </div>

          <p className="text-center text-sm text-muted-foreground mb-6">
            접근하려면 비밀번호를 입력하세요
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              autoFocus
              className="w-full px-4 py-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />

            {error && (
              <p className="text-destructive text-xs mt-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full mt-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                "로그인"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
