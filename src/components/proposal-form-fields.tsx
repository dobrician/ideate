"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, Loader2, Eye, Pencil, X } from "lucide-react";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import type { useProposalForm } from "@/lib/use-proposal-form";
import { MarkdownRenderer } from "./markdown-renderer";

/** Render the title, context and vote for a new idea. */
export function ProposalFormFields({
  form,
  showCancel,
  onCancel,
}: {
  form: ReturnType<typeof useProposalForm>;
  showCancel?: boolean;
  onCancel?: React.ReactNode;
}) {
  const {
    t, isPending, initialVote, setInitialVote,
    title, setTitle, description, setDescription,
    submitWithDuplicateCheck, state, projectId,
    availableTags, selectedTagIds, setSelectedTagIds,
  } = form;
  const [titleTouched, setTitleTouched] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const titleError = titleTouched && title.trim().length > 0 && title.trim().length < 5
    ? t("projectForm.proposalTitleMin")
    : titleTouched && !title.trim()
    ? t("projectForm.proposalTitleRequired")
    : undefined;

  /**
   * onSubmit (not <form action>) avoids React 19's form-action transition
   * which batches state updates until the async function resolves — that
   * delay was making the duplicate modal feel unresponsive. With onSubmit
   * + preventDefault, setModalState("validating") inside the hook commits
   * to the DOM before the LLM fetch begins, so the modal opens instantly.
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    if (!title.trim() || title.trim().length < 5) {
      setTitleTouched(true);
      return;
    }
    const formData = new FormData(e.currentTarget);
    submitWithDuplicateCheck(formData);
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="initialVote" value={initialVote} />
      <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
      <input type="hidden" name="tagIds" value={selectedTagIds.join(",")} />

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <div className="space-y-2">
          <Label htmlFor="proposal-title">{t("proposalForm.titleLabel")}</Label>
          <Input
            id="proposal-title" name="title"
            placeholder={t("proposalForm.titlePlaceholder")}
            className="h-11 bg-background shadow-none"
            maxLength={200} disabled={isPending}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTitleTouched(true)}
            aria-invalid={!!titleError}
            aria-describedby={titleError ? "proposal-title-error" : undefined}
          />
          <p id="proposal-title-error" className="min-h-4 text-xs text-red-700 dark:text-red-400">{titleError}</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <Label htmlFor="proposal-description" className="shrink-0">{t("proposalForm.description")}</Label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${!showPreview ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
                aria-pressed={!showPreview}
              >
                <Pencil className="h-3 w-3" /> {t("proposalForm.write")}
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${showPreview ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"}`}
                aria-pressed={showPreview}
              >
                <Eye className="h-3 w-3" /> {t("proposalForm.preview")}
              </button>
            </div>
          </div>
          {showPreview ? (
            <div className="min-h-40 rounded-md border border-input bg-background px-3 py-3">
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
              rows={6} className="min-h-40 resize-y bg-background leading-relaxed shadow-none" maxLength={5000} disabled={isPending}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-describedby={`proposal-description-hint${state?.error ? " proposal-form-error" : ""}`}
            />
          )}
          <p id="proposal-description-hint" className="break-words text-xs text-muted-foreground">{t("proposalForm.markdownHint")}</p>
          {showPreview && <input type="hidden" name="description" value={description} />}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t("proposalForm.initialVote")}</span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm"
              onClick={() => setInitialVote("1")}
              aria-pressed={initialVote === "1"}
              aria-label={t("vote.pro")}
              className={initialVote === "1" ? "bg-emerald-500/15 text-emerald-900 hover:bg-emerald-500/20 dark:text-emerald-300" : ""}>
              <ThumbsUp className="mr-1 h-4 w-4" aria-hidden="true" /> {t("vote.pro")}
            </Button>
            <Button type="button" variant="ghost" size="sm"
              onClick={() => setInitialVote("-1")}
              aria-pressed={initialVote === "-1"}
              aria-label={t("vote.contra")}
              className={initialVote === "-1" ? "bg-rose-500/15 text-rose-900 hover:bg-rose-500/20 dark:text-rose-300" : ""}>
              <ThumbsDown className="mr-1 h-4 w-4" aria-hidden="true" /> {t("vote.contra")}
            </Button>
          </div>
        </div>

        {availableTags.length > 0 && (
          <details className="border-t pt-2">
            <summary className="cursor-pointer py-3 text-sm text-muted-foreground">{t("tags.projectTags")}</summary>
            <div className="flex flex-wrap gap-1.5 pb-2">
              {availableTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() =>
                      setSelectedTagIds(selected
                        ? selectedTagIds.filter((id) => id !== tag.id)
                        : [...selectedTagIds, tag.id])
                    }
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground hover:border-primary/50"
                    }`}
                    aria-pressed={selected}
                    disabled={isPending}
                  >
                    {tag.name}
                    {selected && <X className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </details>
        )}

        {state?.error && (
          <div id="proposal-form-error" className="rounded-md bg-red-50 p-3 dark:bg-red-950" role="alert">
            <p className="text-sm text-red-800 dark:text-red-200">{state.error}</p>
          </div>
        )}

      </div>
      <div data-proposal-form-footer className="flex shrink-0 items-center justify-end gap-2 border-t bg-muted/30 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {showCancel && onCancel}
        <Button
          type="submit"
          size="default"
          className={`${showCancel ? "" : "w-full"} bg-primary font-semibold text-slate-950 shadow-none hover:bg-primary/90`}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              {t("proposalForm.submitting")}
            </>
          ) : (
            t("proposalForm.submit")
          )}
        </Button>
      </div>
    </form>
  );
}
