"use client";

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

export function VotesOverTimeChart({ data }: { data: VoteOverTimePoint[] }) {
  const { t } = useLocale();

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("charts.votesOverTime")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("charts.noData")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg">{t("charts.votesOverTime")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={t("charts.votesOverTime")}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={35} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                labelFormatter={(label) => String(label)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone" dataKey="pro"
                name={t("vote.pro")} stroke="#22c55e"
                strokeWidth={2} dot={false}
              />
              <Line
                type="monotone" dataKey="contra"
                name={t("vote.contra")} stroke="#ef4444"
                strokeWidth={2} dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function TopProposalsChart({ data }: { data: TopProposal[] }) {
  const { t } = useLocale();

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("charts.topProposals")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("charts.noData")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg">{t("charts.topProposals")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={t("charts.topProposals")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                dataKey="title" type="category"
                tick={{ fontSize: 10 }} width={80}
                tickFormatter={(v: string) => v.length > 15 ? `${v.slice(0, 15)}...` : v}
              />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="pro" name={t("vote.pro")} fill="#22c55e" stackId="votes" />
              <Bar dataKey="contra" name={t("vote.contra")} fill="#ef4444" stackId="votes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivityHeatmapChart({ data }: { data: ActivityPoint[] }) {
  const { t } = useLocale();

  if (data.length === 0) {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">{t("charts.activityHeatmap")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("charts.noData")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 overflow-hidden lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg">{t("charts.activityHeatmap")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={t("charts.activityHeatmap")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={35} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="count" name={t("charts.actions")} fill="#6366f1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
