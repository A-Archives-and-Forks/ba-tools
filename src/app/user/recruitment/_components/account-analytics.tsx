"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  type AccountAggregates,
  type AggregateBucket,
  RECRUITMENT_COLORS,
  type RecruitmentKind,
  type RecruitmentStats,
  applySessionToAggregates,
  emptyAccountAggregates,
} from "@/lib/recruitment";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

type Session = {
  _id: string;
  date: number;
  kind: RecruitmentKind;
  isFestBanner?: boolean;
  totalPulls: number;
  pickupsObtained: { charge: number; studentId: string }[];
  threeStarCount: number;
  stats: Omit<
    RecruitmentStats,
    "pullsPerPU" | "pullsPerThreeStar" | "pickupClassifications"
  > & {
    pullsPerPU?: number | null;
    pullsPerThreeStar?: number | null;
    pickupClassifications: {
      charge: number;
      studentId: string;
      classification: string;
    }[];
  };
};

type Filter = "all" | "permanent" | "limited" | "fest";

export function AccountAnalytics({
  sessions,
  aggregates,
}: {
  sessions: Session[];
  aggregates?: AccountAggregates;
}) {
  const t = useTranslations();
  const [filter, setFilter] = useState<Filter>("all");
  const filteredSessions = useMemo(
    () => sessions.filter((session) => matchesFilter(session, filter)),
    [sessions, filter],
  );
  const sourceAggregates = useMemo(
    () => aggregates ?? rebuildAggregate(sessions),
    [aggregates, sessions],
  );
  const aggregate = aggregateForFilter(sourceAggregates, filter);
  const regular =
    filter === "permanent"
      ? sourceAggregates.permanent
      : filter === "fest"
        ? emptyBucket()
        : mergeBuckets(sourceAggregates.permanent, sourceAggregates.limited);
  const fest = filter === "permanent" ? emptyBucket() : sourceAggregates.fest;

  return (
    <section className="grid w-full max-w-4xl gap-4">
      <div className="flex flex-wrap justify-end gap-1">
        {(["all", "permanent", "limited", "fest"] as const).map((value) => (
          <button
            className={`rounded-md border px-3 py-1 text-sm ${
              filter === value ? "bg-accent font-medium" : ""
            }`}
            key={value}
            onClick={() => setFilter(value)}
            type="button"
          >
            {t(`tools.recruitment.filters.${value}`)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={t("tools.recruitment.regularThreeStarRate")}
          value={rate(regular.totalThreeStars, regular.totalPulls)}
        />
        <Metric
          label={t("tools.recruitment.festThreeStarRate")}
          value={rate(fest?.totalThreeStars ?? 0, fest?.totalPulls ?? 0)}
        />
        <Metric
          label={t("tools.recruitment.accountPURate")}
          value={rate(aggregate.totalPickups, aggregate.totalPulls)}
        />
        <Metric
          label={t("tools.recruitment.averagePullsPerPU")}
          value={average(aggregate.totalPulls, aggregate.totalPickups)}
        />
        <Metric
          label={t("tools.recruitment.totalRebatePulls")}
          value={aggregate.rebatePulls}
        />
        <Metric
          label={t("tools.recruitment.pyroxenesSaved")}
          value={aggregate.pyroxenesSaved.toLocaleString()}
        />
        <Metric
          label={t("tools.recruitment.softPityRecord")}
          value={`${aggregate.softPityWins}/${aggregate.softPityLosses}`}
        />
        <Metric
          label={t("tools.recruitment.softPityWinRate")}
          value={rate(
            aggregate.softPityWins,
            aggregate.softPityWins + aggregate.softPityLosses,
          )}
        />
        <Metric
          label={t("tools.recruitment.hardPityCount")}
          value={aggregate.hardPities}
        />
        <Metric
          label={t("tools.recruitment.hardPityPUPercent")}
          value={rate(aggregate.hardPityPickups, aggregate.totalPickups)}
        />
      </div>
      <div className="grid w-full gap-4">
        <RateHistoryChart sessions={filteredSessions} />
        <PitySummary aggregate={aggregate} />
        <PickupDistributionChart aggregate={aggregate} />
      </div>
    </section>
  );
}

function RateHistoryChart({ sessions }: { sessions: Session[] }) {
  const t = useTranslations();
  const data = sessions
    .slice()
    .sort((a, b) => a.date - b.date)
    .map((session) => ({
      name: new Date(session.date).toLocaleDateString(),
      threeStarRate: session.stats.experiencedThreeStarRate,
      puRate: session.stats.experiencedPURate,
    }));

  return (
    <ChartCard title={t("tools.recruitment.rateHistory")}>
      {data.length === 0 ? (
        <EmptyChart />
      ) : (
        <ChartContainer
          config={{
            threeStarRate: {
              label: t("tools.recruitment.experiencedThreeStarRate"),
              color: RECRUITMENT_COLORS.base.accent,
            },
            puRate: {
              label: t("tools.recruitment.experiencedPURate"),
              color: RECRUITMENT_COLORS.limited.accent,
            },
          }}
        >
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ left: 8, right: 8 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} />
            <YAxis unit="%" tickLine={false} axisLine={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-6">
                      <span className="text-muted-foreground">
                        {name === "threeStarRate"
                          ? t("tools.recruitment.experiencedThreeStarRate")
                          : t("tools.recruitment.experiencedPURate")}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {Number(value).toFixed(2)}%
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Line
              dataKey="threeStarRate"
              dot
              activeDot={{ r: 4 }}
              stroke="var(--color-threeStarRate)"
              strokeWidth={2}
            />
            <Line
              dataKey="puRate"
              dot
              activeDot={{ r: 4 }}
              stroke="var(--color-puRate)"
              strokeWidth={2}
            />
          </LineChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

function PitySummary({ aggregate }: { aggregate: AggregateBucket }) {
  const t = useTranslations();
  const values: {
    key: "beforeSoftPity" | "softWin" | "afterSoftPity" | "hardPity";
    value: number;
    color: string;
  }[] = [
    {
      key: "beforeSoftPity",
      value: aggregate.naturalPickups,
      color: RECRUITMENT_COLORS.base.accent,
    },
    {
      key: "softWin",
      value: aggregate.softWinPickups,
      color: RECRUITMENT_COLORS.base.trackAccent,
    },
    {
      key: "afterSoftPity",
      value: aggregate.softLossPickups,
      color: RECRUITMENT_COLORS.limited.trackAccent,
    },
    {
      key: "hardPity",
      value: aggregate.hardPityPickups,
      color: RECRUITMENT_COLORS.limited.accent,
    },
  ];
  const total = values.reduce((sum, item) => sum + item.value, 0);

  return (
    <ChartCard title={t("tools.recruitment.pitySummary")}>
      {total === 0 ? (
        <EmptyChart />
      ) : (
        <div className="grid gap-4">
          <div className="flex h-8 overflow-hidden rounded-full bg-muted">
            {values.map(
              (item) =>
                item.value > 0 && (
                  <div
                    key={item.key}
                    style={{
                      width: `${(item.value / total) * 100}%`,
                      backgroundColor: item.color,
                    }}
                  />
                ),
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {values.map((item) => (
              <div className="flex items-center gap-2" key={item.key}>
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>
                  {classificationLabel(t, item.key)}: {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function classificationLabel(
  t: ReturnType<typeof useTranslations>,
  key: "beforeSoftPity" | "softWin" | "afterSoftPity" | "hardPity",
) {
  return t(`tools.recruitment.classifications.${key}` as never);
}

function PickupDistributionChart({
  aggregate,
}: { aggregate: AggregateBucket }) {
  const t = useTranslations();
  const data = Array.from({ length: 20 }, (_, index) => {
    const start = index * 10 + 1;
    const count = aggregate.pickupChargeHistogram
      .slice(start, start + 10)
      .reduce((sum, value) => sum + value, 0);
    return { charge: start, count };
  });

  return (
    <ChartCard title={t("tools.recruitment.pickupDistribution")}>
      <ChartContainer
        config={{
          count: {
            label: t("tools.recruitment.pickups"),
            color: RECRUITMENT_COLORS.limited.accent,
          },
        }}
      >
        <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="charge"
            tickFormatter={(charge) => String(Number(charge) + 9)}
            tickLine={false}
            axisLine={false}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(value) => `${value}-${Number(value) + 9}`}
              />
            }
          />
          <ReferenceLine
            x={100}
            stroke={RECRUITMENT_COLORS.base.accent}
            strokeDasharray="4 4"
          />
          <ReferenceLine
            x={200}
            stroke={RECRUITMENT_COLORS.limited.accent}
            strokeDasharray="4 4"
          />
          <Bar dataKey="count" fill="var(--color-count)" radius={2} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function ChartCard({
  title,
  children,
}: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  const t = useTranslations();
  return (
    <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
      {t("tools.recruitment.noAnalyticsData")}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function rate(numerator: number, denominator: number) {
  return denominator === 0
    ? "N/A"
    : `${((numerator / denominator) * 100).toFixed(2)}%`;
}

function average(numerator: number, denominator: number) {
  return denominator === 0 ? "N/A" : (numerator / denominator).toFixed(2);
}

function matchesFilter(session: Session, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "fest") return session.isFestBanner === true;
  if (filter === "limited") return session.kind === "limited";
  return session.kind === "permanent";
}

function emptyBucket(): AggregateBucket {
  return {
    sessionCount: 0,
    totalPulls: 0,
    paidPulls: 0,
    totalThreeStars: 0,
    totalPickups: 0,
    rebatePulls: 0,
    pyroxenesSaved: 0,
    softPityWins: 0,
    softPityLosses: 0,
    hardPities: 0,
    naturalPickups: 0,
    softWinPickups: 0,
    softLossPickups: 0,
    hardPityPickups: 0,
    pickupChargeHistogram: Array.from({ length: 201 }, () => 0),
  };
}

function aggregateForFilter(aggregates: AccountAggregates, filter: Filter) {
  if (filter === "permanent") return aggregates.permanent;
  if (filter === "fest") return aggregates.fest;
  if (filter === "limited")
    return mergeBuckets(aggregates.limited, aggregates.fest);
  return mergeBuckets(
    mergeBuckets(aggregates.permanent, aggregates.limited),
    aggregates.fest,
  );
}

function mergeBuckets(first: AggregateBucket, second: AggregateBucket) {
  const result = emptyBucket();
  for (const key of Object.keys(result) as (keyof AggregateBucket)[]) {
    if (key === "pickupChargeHistogram") {
      result[key] = first[key].map(
        (value, index) => value + second[key][index],
      );
    } else {
      result[key] = first[key] + second[key];
    }
  }
  return result;
}

function rebuildAggregate(sessions: Session[]) {
  let result = emptyAccountAggregates();
  for (const session of sessions) {
    const stats: RecruitmentStats = {
      ...session.stats,
      pullsPerPU: session.stats.pullsPerPU ?? null,
      pullsPerThreeStar: session.stats.pullsPerThreeStar ?? null,
      pickupClassifications: session.stats.pickupClassifications.map(
        (pickup) => ({
          ...pickup,
          classification:
            pickup.classification === "natural"
              ? "beforeSoftPity"
              : pickup.classification === "afterSoftLoss"
                ? "afterSoftPity"
                : pickup.classification,
        }),
      ) as RecruitmentStats["pickupClassifications"],
    };
    result = applySessionToAggregates(
      result,
      session.kind,
      session.isFestBanner ?? false,
      {
        startCharge: 0,
        totalPulls: session.totalPulls,
        threeStarCount: session.threeStarCount,
        rebateTicketsFromPreviousSession: 0,
        rebateTicketsUsed: session.stats.rebateTicketsUsed,
        pickupsObtained: session.pickupsObtained,
      },
      stats,
      1,
    );
  }
  return result;
}
