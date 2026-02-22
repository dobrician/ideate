"use client";

import { useState, useEffect } from "react";
import { Sparkles, ThumbsUp, Users, TrendingUp } from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/lib/use-locale";
import Link from "next/link";

interface Recommendation {
  proposalId: string;
  proposalTitle: string;
  projectId: string;
  projectTitle: string;
  score: number;
  reason: "similar_content" | "voting_pattern" | "popular";
}

export function RecommendationsWidget() {
  const { t } = useLocale();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchRecs() {
      try {
        const res = await fetch("/api/proposals/recommendations?limit=5");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRecs(data.recommendations ?? []);
        }
      } catch {
        // Silently fail — widget is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchRecs();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5" />
            {t("recommendations.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (recs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5" />
            {t("recommendations.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("recommendations.empty")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const reasonIcon = (reason: Recommendation["reason"]) => {
    switch (reason) {
      case "similar_content": return <Sparkles className="h-3.5 w-3.5 text-violet-500" aria-hidden="true" />;
      case "voting_pattern": return <Users className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />;
      case "popular": return <TrendingUp className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />;
    }
  };

  const reasonLabel = (reason: Recommendation["reason"]) => {
    switch (reason) {
      case "similar_content": return t("recommendations.similarContent");
      case "voting_pattern": return t("recommendations.votingPattern");
      case "popular": return t("recommendations.popular");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" />
          {t("recommendations.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2" role="list">
          {recs.map((rec) => (
            <li key={rec.proposalId}>
              <Link
                href={`/projects/${rec.projectId}`}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                {reasonIcon(rec.reason)}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium group-hover:underline">
                    {rec.proposalTitle}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{rec.projectTitle}</span>
                    <span className="shrink-0">{reasonLabel(rec.reason)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
