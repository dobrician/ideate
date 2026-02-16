"use client";

import { useActionState, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProposal } from "@/app/projects/[id]/proposals/actions";
import { ThumbsUp, ThumbsDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";

interface ProposalFormProps {
  projectId: string;
}

/**
 * Collapsible form for creating a new proposal with initial vote.
 * Button + panel layout: button stays compact, panel expands below.
 */
export function ProposalForm({ projectId }: ProposalFormProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [initialVote, setInitialVote] = useState<"1" | "-1">("1");
  const [state, formAction, isPending] = useActionState(createProposal, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(t("proposalForm.created"));
      requestAnimationFrame(() => setIsOpen(false));
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state, t]);

  return (
    <>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant={isOpen ? "outline" : "default"}
        size="sm"
      >
        <Plus className={`mr-1 h-4 w-4 transition-transform ${isOpen ? "rotate-45" : ""}`} />
        {t("proposalForm.newProposal")}
      </Button>

      {isOpen && (
        <div className="col-span-full mt-3 rounded-lg border bg-muted/30 p-4">
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="initialVote" value={initialVote} />

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
              />
            </div>

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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending
                  ? t("proposalForm.submitting")
                  : t("proposalForm.submit")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
