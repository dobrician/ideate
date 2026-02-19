"use client";

import { memo } from "react";
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";

interface VoteOverTimePoint {
  date: string;
  pro: number;
  contra: number;
}

interface TopProposal {
  title: string;
  pro: number;
  contra: number;
}

interface ActivityPoint {
  date: string;
  count: number;
}

/** SVG pattern definitions for color-blind accessible chart fills. */
function ChartPatternDefs() {
  return (
    <defs>
      <pattern id="dash-pro" patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill="#a3b88c" />
        <circle cx="3" cy="3" r="1.5" fill="#fff" opacity="0.3" />
      </pattern>
      <pattern id="dash-contra" patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill="#c8907a" />
        <path d="M0 0L6 6M6 0L0 6" stroke="#fff" strokeWidth="1" opacity="0.3" />
      </pattern>
      <pattern id="dash-activity" patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill="#6366f1" />
        <path d="M0 3H6" stroke="#fff" strokeWidth="1.5" opacity="0.3" />
        <path d="M3 0V6" stroke="#fff" strokeWidth="1.5" opacity="0.3" />
      </pattern>
    </defs>
  );
}

/** Shared tooltip style that respects light/dark theme via CSS variables. */
const tooltipStyle: React.CSSProperties = {
  borderRadius: 8,
  fontSize: 12,
  backgroundColor: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-card-foreground)",
};

function EmptyChart({ title }: { title: string }) {
  const { t } = useLocale();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t("charts.noData")}</p>
      </CardContent>
    </Card>
  );
}

export const VotesOverTimeChart = memo(function VotesOverTimeChart({ data }: { data: VoteOverTimePoint[] }) {
  const { t } = useLocale();
  const title = t("charts.votesOverTime");
  if (data.length === 0) return <EmptyChart title={title} />;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(v: string) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} width={35} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => String(label)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone" dataKey="pro"
                name={t("vote.pro")} stroke="#a3b88c"
                strokeWidth={2} dot={false}
              />
              <Line
                type="monotone" dataKey="contra"
                name={t("vote.contra")} stroke="#c8907a"
                strokeWidth={2} strokeDasharray="6 3" dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export const TopProposalsChart = memo(function TopProposalsChart({ data }: { data: TopProposal[] }) {
  const { t } = useLocale();
  const title = t("charts.topProposals");
  if (data.length === 0) return <EmptyChart title={title} />;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <ChartPatternDefs />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
              <YAxis
                dataKey="title" type="category"
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={80}
                tickFormatter={(v: string) => v.length > 15 ? `${v.slice(0, 15)}...` : v}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pro" name={t("vote.pro")} fill="url(#dash-pro)" stackId="votes" />
              <Bar dataKey="contra" name={t("vote.contra")} fill="url(#dash-contra)" stackId="votes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export const ActivityHeatmapChart = memo(function ActivityHeatmapChart({ data }: { data: ActivityPoint[] }) {
  const { t } = useLocale();
  const title = t("charts.activityHeatmap");
  if (data.length === 0) return <EmptyChart title={title} />;

  return (
    <Card className="min-w-0 overflow-hidden lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <ChartPatternDefs />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                tickFormatter={(v: string) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} allowDecimals={false} width={35} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="count" name={t("charts.actions")} fill="url(#dash-activity)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});
