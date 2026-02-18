"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import { ThumbsUp, ThumbsDown, AlertTriangle, Loader2, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { useProposalForm } from "@/lib/use-proposal-form";
import type { ProposalFormProps } from "@/lib/use-proposal-form";
import { MarkdownRenderer } from "./markdown-renderer";

function ProposalFormFields({
  form,
  showCancel,
  onCancel,
}: {
  form: ReturnType<typeof useProposalForm>;
  showCancel?: boolean;
  onCancel?: React.ReactNode;
}) {
  const {
    t, formAction, isPending, initialVote, setInitialVote,
    title, setTitle, description, setDescription,
    checkingSimilarity, warnings, handleFieldChange, state, projectId,
  } = form;
  const [titleTouched, setTitleTouched] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const titleError = titleTouched && title.trim().length > 0 && title.trim().length < 5
    ? t("projectForm.proposalTitleMin")
    : titleTouched && !title.trim()
    ? t("projectForm.proposalTitleRequired")
    : undefined;

  return (
    <form
      ref={formRef}
      action={(formData) => {
        if (!title.trim() || title.trim().length < 5) {
          setTitleTouched(true);
          return;
        }
        return formAction(formData);
      }}
      className="space-y-4"
      noValidate
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="initialVote" value={initialVote} />
      <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />

      <div className="space-y-1.5">
        <Label htmlFor="proposal-title">{t("proposalForm.titleLabel")}</Label>
        <Input
          id="proposal-title" name="title"
          placeholder={t("proposalForm.titlePlaceholder")}
          maxLength={200} disabled={isPending}
          value={title}
          onChange={(e) => { setTitle(e.target.value); handleFieldChange(e.target.value, description); }}
          onBlur={() => setTitleTouched(true)}
          aria-invalid={!!titleError}
          aria-describedby={titleError ? "proposal-title-error" : undefined}
        />
        {titleError && (
          <p id="proposal-title-error" className="text-xs text-red-700 dark:text-red-400">{titleError}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <Label htmlFor="proposal-description" className="shrink-0">{t("proposalForm.description")}</Label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className={`inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs ${!showPreview ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={!showPreview}
            >
              <Pencil className="h-3 w-3" /> {t("proposalForm.write")}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className={`inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs ${showPreview ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={showPreview}
            >
              <Eye className="h-3 w-3" /> {t("proposalForm.preview")}
            </button>
          </div>
        </div>
        {showPreview ? (
          <div className="min-h-[5rem] rounded-md border border-input bg-background px-3 py-2">
            {description.trim() ? (
              <MarkdownRenderer content={description} className="text-sm" />
            ) : (
              <p className="text-sm text-muted-foreground">{t("proposalForm.previewEmpty")}</p>
            )}
          </div>
        ) : (
          <Textarea
            id="proposal-description" name="description"
            placeholder={t("proposalForm.descriptionPlaceholder")}
            rows={3} maxLength={5000} disabled={isPending}
            value={description}
            onChange={(e) => { setDescription(e.target.value); handleFieldChange(title, e.target.value); }}
            aria-describedby={`proposal-description-hint${state?.error ? " proposal-form-error" : ""}`}
          />
        )}
        <p id="proposal-description-hint" className="break-words text-xs text-muted-foreground">{t("proposalForm.markdownHint")}</p>
        {showPreview && <input type="hidden" name="description" value={description} />}
      </div>

      {checkingSimilarity && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> {t("similarity.checking")}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-2" role="alert" aria-live="polite">
          {warnings.map((m) => (
            <div key={m.id} className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {t("similarity.score", { score: m.similarity })}
                </p>
                {m.explanation && <p className="text-amber-700 dark:text-amber-300">{m.explanation}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>{t("proposalForm.initialVote")}</Label>
        <div className="flex gap-2">
          <Button type="button" variant={initialVote === "1" ? "default" : "outline"} size="sm"
            onClick={() => setInitialVote("1")}
            aria-pressed={initialVote === "1"}
            aria-label={t("vote.pro")}
            className={initialVote === "1" ? "bg-green-600 hover:bg-green-700" : ""}>
            <ThumbsUp className="mr-1 h-4 w-4" aria-hidden="true" /> {t("vote.pro")}
          </Button>
          <Button type="button" variant={initialVote === "-1" ? "default" : "outline"} size="sm"
            onClick={() => setInitialVote("-1")}
            aria-pressed={initialVote === "-1"}
            aria-label={t("vote.contra")}
            className={initialVote === "-1" ? "bg-red-600 hover:bg-red-700" : ""}>
            <ThumbsDown className="mr-1 h-4 w-4" aria-hidden="true" /> {t("vote.contra")}
          </Button>
        </div>
      </div>

      {state?.error && (
        <div id="proposal-form-error" className="rounded-md bg-red-50 p-3 dark:bg-red-950" role="alert">
          <p className="text-sm text-red-800 dark:text-red-200">{state.error}</p>
        </div>
      )}

      <div className={showCancel ? "flex justify-end gap-2" : ""}>
        {showCancel && onCancel}
        <Button type="submit" size="sm" className={showCancel ? "" : "w-full"} disabled={isPending}>
          {isPending ? t("proposalForm.submitting") : t("proposalForm.submit")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Dialog wrapper for mobile/tablet — "New Proposal" button opens a dialog.
 */
export function ProposalForm(props: ProposalFormProps) {
  const form = useProposalForm(props);
  const [open, setOpen] = useState(false);
  const { state, t, resetForm } = form;

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(t("proposalForm.created"));
      resetForm();
      requestAnimationFrame(() => setOpen(false));
    }
    if (state.error) toast.error(state.error);
  }, [state, t, resetForm]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <span className="sm:hidden">{form.t("proposalForm.newProposalShort")}</span>
          <span className="hidden sm:inline">{form.t("proposalForm.newProposal")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.t("proposalForm.title")}</DialogTitle>
        </DialogHeader>
        <ProposalFormFields form={form} showCancel onCancel={
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm" disabled={form.isPending}>
              {form.t("common.cancel")}
            </Button>
          </DialogClose>
        } />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline form for the sticky desktop sidebar — no dialog wrapper.
 */
export function ProposalFormInline(props: ProposalFormProps) {
  const form = useProposalForm(props);
  const { state: inlineState, t: inlineT, resetForm: inlineResetForm } = form;

  useEffect(() => {
    if (!inlineState) return;
    if (inlineState.success) { toast.success(inlineT("proposalForm.created")); inlineResetForm(); }
    if (inlineState.error) toast.error(inlineState.error);
  }, [inlineState, inlineT, inlineResetForm]);

  return (
    <div data-rsc-content className="min-w-0 overflow-hidden rounded-lg border bg-card p-4">
      <h3 className="mb-3 truncate text-sm font-semibold">{form.t("proposalForm.title")}</h3>
      <ProposalFormFields form={form} />
    </div>
  );
}
