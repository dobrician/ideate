"use client";

import { memo } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";

interface TrendPoint { week: string; count: number }
interface VotePoint { date: string; pro: number; contra: number }
interface ProjectPoint { title: string; proposals: number; votes: number; comments: number }
interface DayPoint { day: string; count: number }
interface ActivityPoint { date: string; count: number }

/** SVG pattern definitions for color-blind accessible chart fills. */
function ChartPatternDefs() {
  return (
    <defs>
      <pattern id="pat-indigo" patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill="#6366f1" />
        <path d="M0 0L6 6M6 0L0 6" stroke="#fff" strokeWidth="1" opacity="0.3" />
      </pattern>
      <pattern id="pat-green" patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill="#a3b88c" />
        <circle cx="3" cy="3" r="1.5" fill="#fff" opacity="0.3" />
      </pattern>
      <pattern id="pat-amber" patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill="#f59e0b" />
        <rect x="0" y="2" width="6" height="2" fill="#fff" opacity="0.3" />
      </pattern>
      <pattern id="pat-violet" patternUnits="userSpaceOnUse" width="6" height="6">
        <rect width="6" height="6" fill="#8b5cf6" />
        <path d="M0 3H6" stroke="#fff" strokeWidth="1.5" opacity="0.3" />
        <path d="M3 0V6" stroke="#fff" strokeWidth="1.5" opacity="0.3" />
      </pattern>
    </defs>
  );
}

function EmptyCard({ title }: { title: string }) {
  const { t } = useLocale();
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">{t("charts.noData")}</p></CardContent>
    </Card>
  );
}

export const ProposalTrendChart = memo(function ProposalTrendChart({ data }: { data: TrendPoint[] }) {
  const { t } = useLocale();
  const title = t("analytics.proposalTrend");
  if (data.length === 0) return <EmptyCard title={title} />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <ChartPatternDefs />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={35} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name={t("analytics.proposals")} fill="#8b9dc3" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export const VoteTrendChart = memo(function VoteTrendChart({ data }: { data: VotePoint[] }) {
  const { t } = useLocale();
  const title = t("analytics.voteTrend");
  if (data.length === 0) return <EmptyCard title={title} />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={35} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="pro" name={t("vote.pro")} stroke="#a3b88c" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="contra" name={t("vote.contra")} stroke="#c8907a" strokeWidth={2} strokeDasharray="6 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export const UserGrowthChart = memo(function UserGrowthChart({ data }: { data: TrendPoint[] }) {
  const { t } = useLocale();
  const title = t("analytics.userGrowth");
  if (data.length === 0) return <EmptyCard title={title} />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <ChartPatternDefs />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={35} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name={t("analytics.newUsers")} fill="#a3b88c" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export const ProjectHealthChart = memo(function ProjectHealthChart({ data }: { data: ProjectPoint[] }) {
  const { t } = useLocale();
  const title = t("analytics.projectHealth");
  if (data.length === 0) return <EmptyCard title={title} />;
  return (
    <Card className="lg:col-span-2">
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-72 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <ChartPatternDefs />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="title" type="category" tick={{ fontSize: 10 }} width={100} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="proposals" name={t("analytics.proposals")} fill="#8b9dc3" stackId="a" />
              <Bar dataKey="votes" name={t("analytics.votes")} fill="#a3b88c" stackId="a" />
              <Bar dataKey="comments" name={t("analytics.comments")} fill="#c8907a" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export const EngagementByDayChart = memo(function EngagementByDayChart({ data }: { data: DayPoint[] }) {
  const { t } = useLocale();
  const title = t("analytics.engagementByDay");
  if (data.every((d) => d.count === 0)) return <EmptyCard title={title} />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <ChartPatternDefs />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={35} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" name={t("analytics.actions")} fill="#9b8ec4" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export const ActivityTrendChart = memo(function ActivityTrendChart({ data }: { data: ActivityPoint[] }) {
  const { t } = useLocale();
  const title = t("analytics.activityTrend");
  if (data.length === 0) return <EmptyCard title={title} />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={35} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="count" name={t("analytics.actions")} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});
