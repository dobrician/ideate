"use client";

import { useActionState, useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { createProposal } from "@/app/projects/[id]/proposals/actions";
import { ThumbsUp, ThumbsDown, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";

interface SimilarityMatch {
  id: string;
  similarity: number;
  explanation: string;
}

interface ExistingProposal {
  id: string;
  title: string;
  description?: string;
  summary?: string;
}

interface ProposalFormProps {
  projectId: string;
  projectTitle?: string;
  projectDescription?: string;
  existingProposals?: ExistingProposal[];
}

/**
 * Dialog form for creating a new proposal with initial vote.
 * Includes debounced similarity check against existing proposals.
 */
export function ProposalForm({
  projectId,
  projectTitle,
  projectDescription,
  existingProposals,
}: ProposalFormProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [initialVote, setInitialVote] = useState<"1" | "-1">("1");
  const [state, formAction, isPending] = useActionState(createProposal, null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [similarMatches, setSimilarMatches] = useState<SimilarityMatch[]>([]);
  const [checkingSimilarity, setCheckingSimilarity] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(t("proposalForm.created"));
      setTitle("");
      setDescription("");
      setSimilarMatches([]);
      requestAnimationFrame(() => setOpen(false));
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state, t]);

  const checkSimilarity = useCallback(
    async (t: string, d: string) => {
      if (!existingProposals?.length || !projectTitle || t.length < 5) {
        setSimilarMatches([]);
        return;
      }
      setCheckingSimilarity(true);
      try {
        const res = await fetch("/api/proposals/similarity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: { title: projectTitle, description: projectDescription || "" },
            existing: existingProposals,
            proposal: { title: t, description: d },
          }),
        });
        const data = await res.json();
        const filtered = (data.matches || []).filter(
          (m: SimilarityMatch) => m.similarity > 40
        );
        setSimilarMatches(filtered);
      } catch {
        setSimilarMatches([]);
      } finally {
        setCheckingSimilarity(false);
      }
    },
    [existingProposals, projectTitle, projectDescription]
  );

  function handleFieldChange(newTitle: string, newDesc: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      checkSimilarity(newTitle, newDesc);
    }, 800);
  }

  const warnings = similarMatches.filter((m) => m.similarity > 40);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{t("proposalForm.newProposal")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("proposalForm.title")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="initialVote" value={initialVote} />
          <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />

          <div className="space-y-1.5">
            <Label htmlFor="proposal-title">
              {t("proposalForm.titleLabel")}
            </Label>
            <Input
              id="proposal-title"
              name="title"
              placeholder={t("proposalForm.titlePlaceholder")}
              required
              minLength={5}
              maxLength={200}
              disabled={isPending}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                handleFieldChange(e.target.value, description);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proposal-description">
              {t("proposalForm.description")}
            </Label>
            <Textarea
              id="proposal-description"
              name="description"
              placeholder={t("proposalForm.descriptionPlaceholder")}
              rows={3}
              maxLength={5000}
              disabled={isPending}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                handleFieldChange(title, e.target.value);
              }}
            />
          </div>

          {checkingSimilarity && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("similarity.checking")}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      {t("similarity.score", { score: m.similarity })}
                    </p>
                    {m.explanation && (
                      <p className="text-amber-700 dark:text-amber-300">
                        {m.explanation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("proposalForm.initialVote")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={initialVote === "1" ? "default" : "outline"}
                size="sm"
                onClick={() => setInitialVote("1")}
                className={
                  initialVote === "1"
                    ? "bg-green-600 hover:bg-green-700"
                    : ""
                }
              >
                <ThumbsUp className="mr-1 h-4 w-4" />
                {t("vote.pro")}
              </Button>
              <Button
                type="button"
                variant={initialVote === "-1" ? "default" : "outline"}
                size="sm"
                onClick={() => setInitialVote("-1")}
                className={
                  initialVote === "-1"
                    ? "bg-red-600 hover:bg-red-700"
                    : ""
                }
              >
                <ThumbsDown className="mr-1 h-4 w-4" />
                {t("vote.contra")}
              </Button>
            </div>
          </div>

          {state?.error && (
            <div className="rounded-md bg-red-50 p-3 dark:bg-red-950">
              <p className="text-sm text-red-800 dark:text-red-200">
                {state.error}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" disabled={isPending}>
                {t("common.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending
                ? t("proposalForm.submitting")
                : t("proposalForm.submit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
