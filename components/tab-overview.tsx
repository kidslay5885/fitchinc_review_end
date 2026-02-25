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

// ---- helpers ----
function toChartData(record: Record<string, number>) {
  return Object.entries(record)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
}

function pctLabel(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

// ---- sub-components ----

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <div className="text-[12px] text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-extrabold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-[13px] font-bold mb-3">{title}</div>
      {empty ? (
        <div className="text-[12px] text-muted-foreground text-center py-8">데이터 없음</div>
      ) : (
        children
      )}
    </div>
  );
}

function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
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
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
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
              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
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

function HBarChart({ data }: { data: { name: string; value: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 32 + 8, 80)}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 30, top: 0, bottom: 0 }}>
        <XAxis type="number" hide domain={[0, maxVal]} />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(v: number) => [`${v}명`]} />
        <Bar dataKey="value" fill={BAR_COLOR} radius={[0, 4, 4, 0]} barSize={18} label={{ position: "right", fontSize: 11, fill: "#666" }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RecDonut({ postResponses }: { postResponses: SurveyResponse[] }) {
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
  const genderData = toChartData(demographics.gender);
  const ageData = toChartData(demographics.age);
  const jobData = toChartData(demographics.job);
  const hoursData = toChartData(demographics.hours);
  const channelData = toChartData(demographics.channel);
  const satData = satItems.map((s) => ({ name: s.label, value: s.count }));

  return (
    <div className="space-y-6">
      {/* scope label */}
      <div className="text-[12px] text-muted-foreground">{platformName} · {scopeLabel}</div>

      {/* summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="사전 응답 수" value={`${preResponses.length}명`} />
        <SummaryCard label="후기 응답 수" value={`${postResponses.length}명`} />
        <SummaryCard
          label="만족도 점수"
          value={scores.ps1Avg > 0 || scores.ps2Avg > 0
            ? `${((scores.ps1Avg + scores.ps2Avg) / (scores.ps1Avg > 0 && scores.ps2Avg > 0 ? 2 : 1)).toFixed(1)}`
            : "-"}
          sub="10점 만점"
        />
        <SummaryCard
          label="추천률"
          value={postResponses.length > 0 ? `${scores.recRate}%` : "-"}
        />
      </div>

      {/* charts */}
      <div className="grid grid-cols-2 gap-5">
        {/* 성별 */}
        <ChartCard title="성별 분포" empty={genderData.length === 0}>
          <DonutChart data={genderData} />
        </ChartCard>

        {/* 연령대 */}
        <ChartCard title="연령대 분포" empty={ageData.length === 0}>
          <HBarChart data={ageData} />
        </ChartCard>

        {/* 직업 */}
        <ChartCard title="현재 하고 있는 일" empty={jobData.length === 0}>
          <HBarChart data={jobData} />
        </ChartCard>

        {/* 부업 투자 시간 */}
        <ChartCard title="부업 투자 시간" empty={hoursData.length === 0}>
          <HBarChart data={hoursData} />
        </ChartCard>

        {/* 유입 경로 */}
        <ChartCard title="알게 된 경로" empty={channelData.length === 0}>
          <HBarChart data={channelData} />
        </ChartCard>

        {/* 좋았던 점 */}
        <ChartCard title="좋았던 점" empty={satData.length === 0}>
          <HBarChart data={satData} />
        </ChartCard>

        {/* 커리큘럼 만족도 */}
        <ChartCard title="커리큘럼 만족도" empty={postResponses.length === 0}>
          <div className="flex items-center justify-center gap-8 py-4">
            <RingScore score={scores.ps1Avg} size={80} label="커리큘럼" excluded={scores.ps1Excluded} />
            <RingScore score={scores.ps2Avg} size={80} label="피드백" excluded={scores.ps2Excluded} />
          </div>
        </ChartCard>

        {/* 추천 의향 */}
        <ChartCard title="추천 의향" empty={postResponses.length === 0}>
          <RecDonut postResponses={postResponses} />
        </ChartCard>
      </div>
    </div>
  );
}
