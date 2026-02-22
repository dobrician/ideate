"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Flame, ArrowUpRight } from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/lib/use-locale";
import Link from "next/link";

interface TrendingTopic {
  keyword: string;
  frequency: number;
  growth: number;
}

interface TrendingProposal {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  momentum: number;
  voteVelocity: number;
  commentActivity: number;
}

interface TrendSnapshot {
  topics: TrendingTopic[];
  proposals: TrendingProposal[];
  generatedAt: string;
}

export function TrendingWidget() {
  const { t } = useLocale();
  const [data, setData] = useState<TrendSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchTrends() {
      try {
        const res = await fetch("/api/analytics/trends?days=7");
        if (res.ok && !cancelled) {
          setData(await res.json());
        }
      } catch {
        // Silently fail — widget is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchTrends();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            {t("trending.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const topics = data?.topics ?? [];
  const proposals = data?.proposals ?? [];
  const hasContent = topics.length > 0 || proposals.length > 0;

  if (!hasContent) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          {t("trending.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {topics.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("trending.topics")}
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {topics.slice(0, 8).map((topic) => (
                <Badge
                  key={topic.keyword}
                  variant="secondary"
                  className="gap-1"
                >
                  <Flame className="h-3 w-3 text-orange-500" aria-hidden="true" />
                  {topic.keyword}
                  {topic.growth > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t("trending.growth", { pct: topic.growth })}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {proposals.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("trending.proposals")}
            </h3>
            <ul className="space-y-2" role="list">
              {proposals.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.projectId}`}
                    className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                  >
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium group-hover:underline">
                        {p.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.projectTitle}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
