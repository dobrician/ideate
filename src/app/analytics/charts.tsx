"use client";

import { memo } from "react";
import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/lib/use-locale";
import type { ProposalVelocity } from "@/lib/analytics/velocity";
import type { MomentumScore } from "@/lib/analytics/momentum";
import type { UserNode } from "@/lib/analytics/social";
import type { SuccessPrediction } from "@/lib/analytics/predictions";

function EmptyCard({ title }: { title: string }) {
  const { t } = useLocale();
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">{t("advancedAnalytics.noData")}</p></CardContent>
    </Card>
  );
}

export const VelocityChart = memo(function VelocityChart({
  data, title,
}: { data: ProposalVelocity[]; title: string }) {
  if (data.length === 0) return <EmptyCard title={title} />;

  const chartData = data.slice(0, 10).map((d) => ({
    name: d.proposalTitle.length > 18 ? d.proposalTitle.slice(0, 18) + "..." : d.proposalTitle,
    rate: d.currentRate,
    acceleration: Math.abs(d.acceleration),
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="rate" name="Votes/Day" fill="#6366f1" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export const MomentumChart = memo(function MomentumChart({
  data, title,
}: { data: MomentumScore[]; title: string }) {
  if (data.length === 0) return <EmptyCard title={title} />;

  const chartData = data.slice(0, 10).map((d) => ({
    name: d.proposalTitle.length > 18 ? d.proposalTitle.slice(0, 18) + "..." : d.proposalTitle,
    score: d.score,
    votes: d.voteComponent,
    comments: d.commentComponent,
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="score" name="Momentum" fill="#a3b88c" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export const InfluenceChart = memo(function InfluenceChart({
  data, title,
}: { data: UserNode[]; title: string }) {
  if (data.length === 0) return <EmptyCard title={title} />;

  const chartData = data.slice(0, 10).map((d) => ({
    name: d.name.length > 18 ? d.name.slice(0, 18) + "..." : d.name,
    influence: d.influence,
    proposals: d.proposalCount,
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="influence" name="Influence" fill="#f59e0b" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});

export const PredictionChart = memo(function PredictionChart({
  data, title,
}: { data: SuccessPrediction[]; title: string }) {
  if (data.length === 0) return <EmptyCard title={title} />;

  const chartData = data.slice(0, 10).map((d) => ({
    name: d.proposalTitle.length > 18 ? d.proposalTitle.slice(0, 18) + "..." : d.proposalTitle,
    probability: d.probability,
    confidence: d.confidence,
  }));

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64 w-full" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="probability" name="Probability" fill="#8b5cf6" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});
