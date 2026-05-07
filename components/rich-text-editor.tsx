"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

// ===== 색상 그리드 (네이버폼/구글독스 스타일) =====

const COLOR_GRID = [
  ["#000000","#434343","#666666","#999999","#b7b7b7","#cccccc","#d9d9d9","#efefef","#f3f3f3","#ffffff"],
  ["#980000","#ff0000","#ff9900","#ffff00","#00ff00","#00ffff","#4a86e8","#0000ff","#9900ff","#ff00ff"],
  ["#e6b8af","#f4cccc","#fce5cd","#fff2cc","#d9ead3","#d0e0e3","#c9daf8","#cfe2f3","#d9d2e9","#ead1dc"],
  ["#dd7e6b","#ea9999","#f9cb9c","#ffe599","#b6d7a8","#a2c4c9","#a4c2f4","#9fc5e8","#b4a7d6","#d5a6bd"],
  ["#cc4125","#e06666","#f6b26b","#ffd966","#93c47d","#76a5af","#6d9eeb","#6fa8dc","#8e7cc3","#c27ba0"],
  ["#a61c00","#cc0000","#e69138","#f1c232","#6aa84f","#45818e","#3c78d8","#3d85c6","#674ea7","#a64d79"],
  ["#85200c","#990000","#b45f06","#bf9000","#38761d","#134f5c","#1155cc","#0b5394","#351c75","#741b47"],
];

const RECENT_KEY = "editor_recent_colors";

function getRecentColors(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}

function addRecentColor(c: string) {
  const list = getRecentColors().filter((v) => v.toLowerCase() !== c.toLowerCase());
  list.unshift(c);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10))); } catch {}
}

// ===== 컴포넌트 =====

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const internalChange = useRef(false);
  const [showColors, setShowColors] = useState(false);
  const [activeColor, setActiveColor] = useState("#000000");
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const customColorRef = useRef<HTMLInputElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  // 팝업 열 때 최근 색상 로드
  useEffect(() => {
    if (showColors) setRecentColors(getRecentColors());
  }, [showColors]);

  useEffect(() => {
    if (editorRef.current && !internalChange.current) {
      editorRef.current.innerHTML = value;
    }
    internalChange.current = false;
  }, [value]);

  const handleInput = () => {
    internalChange.current = true;
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    handleInput();
  };

  const applyColor = (c: string) => {
    addRecentColor(c);
    setActiveColor(c);
    exec("foreColor", c);
    setShowColors(false);
  };

  // 커서 위치의 글자색 감지 → 아이콘 색상 바에 반영
  const syncActiveColor = () => {
    try {
      const raw = document.queryCommandValue("foreColor");
      if (!raw) return;
      if (raw.startsWith("#")) { setActiveColor(raw); return; }
      const m = raw.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) setActiveColor(`#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`);
    } catch {}
  };

  const isEmpty =
    !value || value === "<br>" || value.replace(/<[^>]*>/g, "").trim() === "";

  const swatchCls = "w-[18px] h-[18px] rounded-sm border border-gray-200 hover:scale-125 hover:z-10 transition-transform cursor-pointer flex-shrink-0";

  return (
    <div className={`rounded-md border hover:border-gray-400 focus-within:border-primary/40 transition-colors overflow-hidden ${className || ""}`}>
      {/* 서식 툴바 */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-colors" title="굵게">
          <span className="text-[12px] font-bold">B</span>
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-colors" title="기울임">
          <span className="text-[12px] italic">I</span>
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-colors" title="밑줄">
          <span className="text-[12px] underline">U</span>
        </button>

        {/* 글자색 */}
        <div className="relative">
          <button
            ref={colorBtnRef}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (!showColors && colorBtnRef.current) {
                const r = colorBtnRef.current.getBoundingClientRect();
                const popupW = 232;
                let left = r.left;
                if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
                if (left < 8) left = 8;
                setPopupPos({ top: r.bottom + 4, left });
              }
              setShowColors(!showColors);
            }}
            className="h-6 px-0.5 flex items-center gap-px rounded hover:bg-accent transition-colors"
            title="글자 색"
          >
            <span className="flex flex-col items-center w-4">
              <span className="text-[12px] font-bold leading-none">A</span>
              <span className="w-full h-[3px] rounded-sm mt-px" style={{ backgroundColor: activeColor }} />
            </span>
            <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
          </button>

          {showColors && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColors(false)} />
              <div
                className="fixed z-50 bg-card rounded-xl border shadow-xl w-[232px]"
                style={popupPos ? { top: popupPos.top, left: popupPos.left } : undefined}
              >
                {/* 헤더 */}
                <div className="px-3 pt-2.5 pb-1">
                  <span className="text-[11px] font-bold text-foreground">글자색 변경</span>
                </div>

                {/* 최근 사용한 글자색 */}
                {recentColors.length > 0 && (
                  <div className="px-3 pb-1.5">
                    <span className="text-[10px] text-muted-foreground">최근 사용한 글자색</span>
                    <div className="flex gap-[3px] mt-1">
                      {recentColors.map((c, i) => (
                        <button
                          key={`${c}-${i}`}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); applyColor(c); }}
                          className={swatchCls}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 구분선 */}
                <div className="border-t border-border/60 mx-2" />

                {/* 색상 그리드 */}
                <div className="px-3 py-2 flex flex-col gap-[3px]">
                  {COLOR_GRID.map((row, ri) => (
                    <div key={ri} className="flex gap-[3px]">
                      {row.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); applyColor(c); }}
                          className={swatchCls}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                {/* 더보기 (커스텀 색상) */}
                <div className="border-t border-border/60 mx-2" />
                <div className="px-3 py-2 flex justify-center">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => customColorRef.current?.click()}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    더보기 <ChevronDown className="w-3 h-3" />
                  </button>
                  <input
                    ref={customColorRef}
                    type="color"
                    className="absolute w-0 h-0 opacity-0 pointer-events-none"
                    onChange={(e) => applyColor(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <span className="w-px h-4 bg-border mx-1" />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-accent transition-colors" title="서식 제거">
          <span className="text-[10px] text-muted-foreground">T<sub>x</sub></span>
        </button>
      </div>

      {/* 편집 영역 */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onClick={syncActiveColor}
          onKeyUp={syncActiveColor}
          className="min-h-[80px] max-h-[200px] overflow-y-auto py-2 px-2.5 text-[12px] bg-background outline-none leading-relaxed"
        />
        {isEmpty && (
          <div className="absolute top-2 left-2.5 text-[12px] text-gray-300 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
