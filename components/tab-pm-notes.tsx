"use client";

import { useState, useEffect, useCallback } from "react";
import type { Instructor, Cohort, NoteData } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface TabPMNotesProps {
  instructor: Instructor;
  cohort: Cohort | null;
  platformName: string;
}

const defaultNotes: NoteData = {
  good: "",
  bad: "",
  action: "",
  memo: "",
};

export function TabPMNotes({ instructor, cohort, platformName }: TabPMNotesProps) {
  const cohortLabel = cohort?.label || "__all__";
  const [noteData, setNoteData] = useState<NoteData>(defaultNotes);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // API에서 노트 로드
  useEffect(() => {
    setLoaded(false);
    const params = new URLSearchParams({
      platform: platformName,
      instructor: instructor.name,
      cohort: cohortLabel,
    });

    fetch(`/api/notes?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setNoteData({
          good: data.good || "",
          bad: data.bad || "",
          action: data.action || "",
          memo: data.memo || "",
        });
        setLoaded(true);
      })
      .catch(() => {
        setNoteData(defaultNotes);
        setLoaded(true);
      });
  }, [platformName, instructor.name, cohortLabel]);

  // 자동 저장 (500ms 디바운스)
  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      setSaving(true);
      fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platformName,
          instructor: instructor.name,
          cohort: cohortLabel,
          ...noteData,
        }),
      })
        .catch(() => {})
        .finally(() => setSaving(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [noteData, loaded, platformName, instructor.name, cohortLabel]);

  const update = useCallback(
    (field: keyof NoteData) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setNoteData((prev) => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border p-4 border-t-[3px] border-t-emerald-500">
          <div className="text-[14px] font-bold mb-3">잘된 점</div>
          <textarea
            value={noteData.good}
            onChange={update("good")}
            placeholder="이번 기수에서 잘된 점을 정리하세요..."
            className="w-full min-h-[130px] p-3 rounded-lg border bg-muted text-[13px] leading-relaxed font-inherit resize-y"
          />
        </div>
        <div className="bg-card rounded-xl border p-4 border-t-[3px] border-t-amber-500">
          <div className="text-[14px] font-bold mb-3">아쉬운 점</div>
          <textarea
            value={noteData.bad}
            onChange={update("bad")}
            placeholder="개선이 필요한 점을 정리하세요..."
            className="w-full min-h-[130px] p-3 rounded-lg border bg-muted text-[13px] leading-relaxed font-inherit resize-y"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border p-4 border-t-[3px] border-t-primary">
        <div className="flex justify-between items-center mb-3">
          <div className="text-[14px] font-bold">다음 기수 추천 액션 플랜</div>
          <span className="text-[11px] text-muted-foreground">구체적 행동 + 이유</span>
        </div>
        <textarea
          value={noteData.action}
          onChange={update("action")}
          placeholder={"□ [강사 요청] 줌 라이브 중 10분마다 채팅 확인\n→ 이유: ...\n\n□ [플랫폼] 영상 공유 기간 연장\n→ 이유: ..."}
          className="w-full min-h-[220px] p-3 rounded-lg border bg-muted text-[13px] leading-loose font-inherit resize-y"
        />
      </div>

      <div className="bg-card rounded-xl border p-4">
        <div className="text-[14px] font-bold mb-3">자유 메모</div>
        <textarea
          value={noteData.memo}
          onChange={update("memo")}
          placeholder="이번 기수에서 느낀 점..."
          className="w-full min-h-[100px] p-3 rounded-lg border bg-muted text-[13px] leading-relaxed font-inherit resize-y"
        />
      </div>

      <div className="text-[11px] text-muted-foreground text-right flex items-center justify-end gap-1.5">
        {saving && <Loader2 className="w-3 h-3 animate-spin" />}
        {saving ? "저장 중..." : "자동 저장됨 (Supabase)"}
      </div>
    </div>
  );
}
