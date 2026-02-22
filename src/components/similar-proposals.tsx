"use client";

import { useState, useEffect } from "react";
import { GitCompareArrows } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocale } from "@/lib/use-locale";
import Link from "next/link";

interface SimilarProposal {
  id: string;
  title: string;
  projectId: string;
  score: number;
}

interface SimilarProposalsProps {
  proposalId: string;
  projectId: string;
}

export function SimilarProposals({ proposalId, projectId }: SimilarProposalsProps) {
  const { t } = useLocale();
  const [items, setItems] = useState<SimilarProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchSimilar() {
      try {
        const res = await fetch(`/api/proposals/similarity?proposalId=${encodeURIComponent(proposalId)}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setItems(data.similar ?? []);
        }
      } catch {
        // Non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSimilar();
    return () => { cancelled = true; };
  }, [proposalId]);

  if (loading) {
    return (
      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <GitCompareArrows className="h-3.5 w-3.5" />
          {t("similar.title")}
        </h4>
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <GitCompareArrows className="h-3.5 w-3.5" />
        {t("similar.title")}
      </h4>
      <ul className="space-y-1" role="list">
        {items.slice(0, 3).map((item) => (
          <li key={item.id}>
            <Link
              href={`/projects/${item.projectId || projectId}`}
              className="block truncate rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-muted/50 hover:underline"
              title={item.title}
            >
              {item.title}
              <span className="ml-1 text-muted-foreground">
                {t("similar.score", { pct: Math.round(item.score * 100) })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
