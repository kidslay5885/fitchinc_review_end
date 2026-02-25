"use client";

import { useMemo } from "react";
import type { Instructor, Course, Cohort, SurveyResponse } from "@/lib/types";
import { allCohorts } from "@/lib/types";
import {
  computeDemographics,
  computeScores,
  getSatisfactionItems,
} from "@/lib/analysis-engine";
import { RingScore } from "@/components/ring-score";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ---- colours ----
const PIE_COLORS = ["#3451B2", "#E5484D", "#46A758", "#F76B15", "#6E56CF", "#30A46C", "#E093D3", "#889096"];
const BAR_COLOR = "#3451B2";

// 성별 고정 색상
const GENDER_COLOR_MAP: Record<string, string> = { "여성": "#E5484D", "남성": "#3451B2" };
const GENDER_ORDER = ["여성", "남성"];

// ---- helpers ----

/** 라벨에서 첫 번째 숫자를 추출해 정렬 키로 사용 */
function labelSortKey(label: string): number {
  const m = label.match(/\d+/);
  if (!m) return Infinity;
  let n = parseInt(m[0]);
  if (label.includes("미만") || label.includes("이하")) n -= 0.5;
  if (label.includes("이상") || label.includes("초과")) n += 0.5;
  return n;
}

/** 라벨의 자연 순서(숫자 → 한국어)로 정렬된 차트 데이터 */
export function toChartData(record: Record<string, number>) {
  return Object.entries(record)
    .filter(([, v]) => v > 0)
    .sort((a, b) => {
      const ka = labelSortKey(a[0]);
      const kb = labelSortKey(b[0]);
      if (ka !== kb) return ka - kb;
      return a[0].localeCompare(b[0], "ko");
    })
    .map(([name, value]) => ({ name, value }));
}

/** 특정 항목을 맨 위/맨 아래로 고정 (대소문자 무시) */
export function pinItems(
  data: { name: string; value: number }[],
  opts: { top?: string[]; bottom?: string[] },
) {
  const match = (name: string, list: string[]) =>
    list.some((k) => name.toLowerCase() === k.toLowerCase());
  const top = opts.top ? data.filter((d) => match(d.name, opts.top!)) : [];
  const bottom = opts.bottom ? data.filter((d) => match(d.name, opts.bottom!)) : [];
  const middle = data.filter((d) => !top.includes(d) && !bottom.includes(d));
  return [...top, ...middle, ...bottom];
}

/** 성별 데이터: 여성(위) → 남성(아래) 고정 순서 + 고정 색상 */
export function toGenderData(record: Record<string, number>): { data: { name: string; value: number }[]; colors: string[] } {
  const ordered: { name: string; value: number }[] = [];
  for (const g of GENDER_ORDER) {
    if (record[g] && record[g] > 0) ordered.push({ name: g, value: record[g] });
  }
  for (const [name, value] of Object.entries(record)) {
    if (!GENDER_ORDER.includes(name) && value > 0) ordered.push({ name, value });
  }
  const colors = ordered.map((d) => GENDER_COLOR_MAP[d.name] || PIE_COLORS[0]);
  return { data: ordered, colors };
}

function pctLabel(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

// ---- sub-components ----

export function SummaryCard({ label, value, sub, tip }: { label: string; value: string | number; sub?: string; tip?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center cursor-default" title={tip}>
      <div className="text-[12px] text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-extrabold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function ChartCard({ title, children, empty, tip }: { title: string; children: React.ReactNode; empty?: boolean; tip?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-[13px] font-bold mb-3 cursor-default" title={tip}>{title}</div>
      {empty ? (
        <div className="text-[12px] text-muted-foreground text-center py-8">데이터 없음</div>
      ) : (
        children
      )}
    </div>
  );
}

export function DonutChart({ data, colors }: { data: { name: string; value: number }[]; colors?: string[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const getColor = (i: number) => colors?.[i] ?? PIE_COLORS[i % PIE_COLORS.length];
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={140} height={140}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={38}
            outerRadius={62}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={getColor(i)} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v}명 (${pctLabel(v, total)})`]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-col gap-1.5 text-[12px]">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: getColor(i) }}
            />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-semibold">{d.value}명</span>
            <span className="text-muted-foreground">({pctLabel(d.value, total)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HBarChart({ data }: { data: { name: string; value: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const renderLabel = (props: { x: number; y: number; width: number; height: number; value: number }) => {
    const pct = total > 0 ? Math.round((props.value / total) * 100) : 0;
    return (
      <text x={props.x + props.width + 4} y={props.y + props.height / 2} dominantBaseline="central" fontSize={11} fill="#666">
        {props.value}<tspan fontSize={9} fill="#999">({pct}%)</tspan>
      </text>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 32 + 8, 80)}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 50, top: 0, bottom: 0 }}>
        <XAxis type="number" hide domain={[0, maxVal]} />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(v: number) => [`${v}명 (${total > 0 ? Math.round((v / total) * 100) : 0}%)`]} />
        <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={18} label={renderLabel} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RecDonut({ postResponses }: { postResponses: SurveyResponse[] }) {
  if (postResponses.length === 0) return <div className="text-[12px] text-muted-foreground text-center py-8">데이터 없음</div>;

  let yesCount = 0;
  let noCount = 0;
  let etcCount = 0;

  for (const r of postResponses) {
    const v = (r.pRec || "").trim();
    if (!v) continue;
    if (/네|넵|추천|강추|할|싶/i.test(v)) yesCount++;
    else if (/아니|없|안|글쎄/i.test(v)) noCount++;
    else etcCount++;
  }

  const data = [
    { name: "추천", value: yesCount },
    { name: "비추천", value: noCount },
    ...(etcCount > 0 ? [{ name: "기타", value: etcCount }] : []),
  ].filter((d) => d.value > 0);

  if (data.length === 0) return <div className="text-[12px] text-muted-foreground text-center py-8">데이터 없음</div>;
  return <DonutChart data={data} />;
}

// ---- main ----

interface TabOverviewProps {
  instructor: Instructor;
  course: Course | null;
  cohort: Cohort | null;
  platformName: string;
}

export function TabOverview({ instructor, course, cohort, platformName }: TabOverviewProps) {
  // 응답 수집
  const { preResponses, postResponses } = useMemo(() => {
    const cohorts = cohort
      ? [cohort]
      : course
        ? course.cohorts
        : allCohorts(instructor);
    return {
      preResponses: cohorts.flatMap((c) => c.preResponses),
      postResponses: cohorts.flatMap((c) => c.postResponses),
    };
  }, [instructor, course, cohort]);

  const allResponses = useMemo(() => [...preResponses, ...postResponses], [preResponses, postResponses]);

  const demographics = useMemo(() => computeDemographics(allResponses), [allResponses]);
  const scores = useMemo(() => computeScores(postResponses), [postResponses]);
  const satItems = useMemo(() => getSatisfactionItems(postResponses), [postResponses]);

  const noData = preResponses.length === 0 && postResponses.length === 0;

  if (noData) {
    return (
      <div className="text-center py-16">
        <div className="text-[14px] font-semibold text-muted-foreground">데이터 없음</div>
        <div className="text-[12px] text-muted-foreground mt-1">
          설문 파일을 업로드하면 차트가 표시됩니다.
        </div>
      </div>
    );
  }

  const scopeLabel = cohort
    ? `${cohort.label}`
    : course
      ? `${course.name} 전체`
      : `${instructor.name} 전체`;

  // chart data
  const gender = toGenderData(demographics.gender);
  const ageData = toChartData(demographics.age);
  const jobData = pinItems(toChartData(demographics.job), { bottom: ["기타"] });
  const hoursData = toChartData(demographics.hours);
  const channelData = pinItems(toChartData(demographics.channel), { top: ["SNS", "sns"] });
  const satData = satItems.map((s) => ({ name: s.label, value: s.count }));

  return (
    <div className="space-y-6">
      {/* scope label */}
      <div className="text-[12px] text-muted-foreground">{platformName} · {scopeLabel}</div>

      {/* summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="사전 응답 수" value={`${preResponses.length}명`} tip="강의 시작 전 사전 설문에 참여한 총 응답자 수" />
        <SummaryCard label="후기 응답 수" value={`${postResponses.length}명`} tip="강의 종료 후 후기 설문에 참여한 총 응답자 수" />
        <SummaryCard
          label="만족도 점수"
          value={scores.ps1Avg > 0 || scores.ps2Avg > 0
            ? `${((scores.ps1Avg + scores.ps2Avg) / (scores.ps1Avg > 0 && scores.ps2Avg > 0 ? 2 : 1)).toFixed(1)}`
            : "-"}
          sub="10점 만점"
          tip="후기 설문의 '커리큘럼 만족도'와 '피드백 만족도' 점수의 평균입니다. 10점 만점 기준으로 환산됩니다."
        />
        <SummaryCard
          label="추천률"
          value={postResponses.length > 0 ? `${scores.recRate}%` : "-"}
          tip="후기 설문 '이 강의를 지인분들께 추천하실 것 같으신가요?' 문항에서 긍정 응답을 한 비율입니다."
        />
      </div>

      {/* charts */}
      <div className="grid grid-cols-2 gap-5">
        {/* 성별 */}
        <ChartCard title="성별 분포" empty={gender.data.length === 0} tip="설문 응답자의 성별 비율">
          <DonutChart data={gender.data} colors={gender.colors} />
        </ChartCard>

        {/* 연령대 */}
        <ChartCard title="연령대 분포" empty={ageData.length === 0} tip="설문 응답자의 연령대 분포">
          <HBarChart data={ageData} />
        </ChartCard>

        {/* 직업 */}
        <ChartCard title="현재 하고 있는 일" empty={jobData.length === 0} tip="설문 응답자의 현재 직업 분포">
          <HBarChart data={jobData} />
        </ChartCard>

        {/* 부업 투자 시간 */}
        <ChartCard title="부업 투자 시간" empty={hoursData.length === 0} tip="설문 응답자가 부업에 투자하는 시간 분포">
          <HBarChart data={hoursData} />
        </ChartCard>

        {/* 유입 경로 */}
        <ChartCard title="알게 된 경로" empty={channelData.length === 0} tip="설문 응답자가 해당 강의를 알게 된 경로 분포">
          <HBarChart data={channelData} />
        </ChartCard>

        {/* 좋았던 점 */}
        <ChartCard title="좋았던 점" empty={satData.length === 0} tip="후기 설문 '만족스러웠던 점'에 대한 응답을 항목별로 집계한 수치">
          <HBarChart data={satData} />
        </ChartCard>

        {/* 커리큘럼 만족도 */}
        <ChartCard title="커리큘럼 만족도" empty={postResponses.length === 0} tip="후기 설문의 '커리큘럼 만족도'와 '피드백 만족도' 점수를 각각 10점 만점으로 환산한 평균값">
          <div className="flex items-center justify-center gap-8 py-4">
            <RingScore score={scores.ps1Avg} size={80} label="커리큘럼" excluded={scores.ps1Excluded} />
            <RingScore score={scores.ps2Avg} size={80} label="피드백" excluded={scores.ps2Excluded} />
          </div>
        </ChartCard>

        {/* 추천 의향 */}
        <ChartCard title="추천 의향" empty={postResponses.length === 0} tip="후기 설문 '이 강의를 지인분들께 추천하실 것 같으신가요?'에 대한 응답을 긍정/부정으로 분류한 비율">
          <RecDonut postResponses={postResponses} />
        </ChartCard>
      </div>
    </div>
  );
}
