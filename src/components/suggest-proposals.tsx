"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { SuggestionCard } from "@/components/suggestion-card";
import type { Suggestion, SuggestionWithVote } from "@/components/suggestion-card";

interface Props {
  projectId: string;
  projectTitle: string;
  projectDescription: string;
  existingProposals: { title: string; description?: string; summary?: string }[];
}

export function SuggestProposalsButton({
  projectId,
  projectTitle,
  projectDescription,
  existingProposals,
}: Props) {
  const { t, locale } = useLocale();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionWithVote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [detailIdx, setDetailIdx] = useState<number | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);

  async function generate() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setSuggestions([]);

    try {
      const res = await fetch("/api/proposals/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: { title: projectTitle, description: projectDescription },
          proposals: existingProposals,
          locale,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.proposals?.length) {
        const codeMap: Record<string, string> = {
          RATE_LIMITED: "suggestions.rateLimited",
          NO_KEYS: "suggestions.noKeys",
          AI_UNAVAILABLE: "suggestions.unavailable",
        };
        const key = codeMap[data.code as string];
        setError(key ? t(key) : (data.error || t("suggestions.none")));
        return;
      }

      setSuggestions(
        data.proposals.map((s: Suggestion) => ({ ...s, vote: null }))
      );
      setModelUsed(data.modelUsed ?? null);
    } catch {
      setError(t("suggestions.error"));
    } finally {
      setLoading(false);
    }
  }

  function setVote(idx: number, vote: 1 | -1) {
    setSuggestions((prev) =>
      prev.map((s, i) =>
        i === idx ? { ...s, vote: s.vote === vote ? null : vote } : s
      )
    );
  }

  const voted = suggestions.filter((s) => s.vote !== null);

  async function submitSelected() {
    if (voted.length === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/proposals/submit-suggested", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          proposals: voted.map((s) => ({
            title: s.title,
            details: s.details,
            summary: s.summary,
            vote: s.vote,
          })),
          csrfToken: getCsrfTokenClient(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(t("suggestions.added", { count: data.created }));
        setOpen(false);
        router.refresh();
      } else {
        toast.error(data.error || t("suggestions.error"));
      }
    } catch {
      toast.error(t("suggestions.error"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setSuggestions([]);
    setError(null);
    setDetailIdx(null);
    setModelUsed(null);
  }

  return (
    <>
      <Button onClick={generate} variant="outline" size="sm">
        <Sparkles className="h-4 w-4" />
        {t("suggestions.cta")}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent className="sm:max-w-3xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{t("suggestions.title")}</DialogTitle>
            <DialogDescription>{t("suggestions.subtitle")}</DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-lg border p-4">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="mt-2 h-3 w-full rounded bg-muted" />
                  <div className="mt-1 h-3 w-4/5 rounded bg-muted" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-7 w-10 rounded bg-muted" />
                    <div className="h-7 w-10 rounded bg-muted" />
                    <div className="h-7 w-20 rounded bg-muted" />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-center gap-2 pt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  {t("suggestions.generating")}
                </span>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="py-4 sm:py-6 text-center text-sm text-muted-foreground" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && suggestions.length > 0 && detailIdx === null && (
            <div className="space-y-2 sm:space-y-3">
              {suggestions.map((s, i) => (
                <SuggestionCard
                  key={i}
                  suggestion={s}
                  onVote={(v) => setVote(i, v)}
                  onViewDetails={() => setDetailIdx(i)}
                  t={t}
                />
              ))}
            </div>
          )}

          {detailIdx !== null && suggestions[detailIdx] && (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setDetailIdx(null)}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t("projectForm.goBack")}
              </Button>
              <h3 className="text-base font-semibold">{suggestions[detailIdx].title}</h3>
              <p className="text-sm text-muted-foreground">
                {suggestions[detailIdx].summary || t("suggestions.noSummary")}
              </p>
              <MarkdownRenderer content={suggestions[detailIdx].details} />
            </div>
          )}

          {!loading && modelUsed && suggestions.length > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              {t("suggestions.modelDisclosure", { model: modelUsed })}
            </p>
          )}

          {!loading && (
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleClose}>
                {error || suggestions.length === 0
                  ? t("suggestions.close")
                  : t("suggestions.cancel")}
              </Button>
              {suggestions.length > 0 && detailIdx === null && (
                <Button
                  size="sm"
                  onClick={submitSelected}
                  disabled={voted.length === 0 || submitting}
                >
                  {submitting
                    ? t("suggestions.submitting")
                    : t("suggestions.addSelected")}
                  {voted.length > 0 && ` (${voted.length})`}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
