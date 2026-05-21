"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetTrigger, SheetClose,
} from "@/components/ui/sheet";
import { ThumbsUp, ThumbsDown, Loader2, Eye, Pencil, X, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { useProposalForm } from "@/lib/use-proposal-form";
import type { ProposalFormProps } from "@/lib/use-proposal-form";
import { MarkdownRenderer } from "./markdown-renderer";
import { castVote } from "@/app/projects/[id]/proposals/actions";

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
      className="space-y-4"
      noValidate
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="initialVote" value={initialVote} />
      <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
      <input type="hidden" name="tagIds" value={selectedTagIds.join(",")} />

      <div className="space-y-1.5">
        <Label htmlFor="proposal-title">{t("proposalForm.titleLabel")}</Label>
        <Input
          id="proposal-title" name="title"
          placeholder={t("proposalForm.titlePlaceholder")}
          maxLength={200} disabled={isPending}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
            onChange={(e) => setDescription(e.target.value)}
            aria-describedby={`proposal-description-hint${state?.error ? " proposal-form-error" : ""}`}
          />
        )}
        <p id="proposal-description-hint" className="break-words text-xs text-muted-foreground">{t("proposalForm.markdownHint")}</p>
        {showPreview && <input type="hidden" name="description" value={description} />}
      </div>

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

      {availableTags.length > 0 && (
        <div className="space-y-1.5">
          <Label>{t("tags.projectTags")}</Label>
          <div className="flex flex-wrap gap-1.5">
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
        </div>
      )}

      {state?.error && (
        <div id="proposal-form-error" className="rounded-md bg-red-50 p-3 dark:bg-red-950" role="alert">
          <p className="text-sm text-red-800 dark:text-red-200">{state.error}</p>
        </div>
      )}

      <div className={showCancel ? "flex justify-end gap-2" : ""}>
        {showCancel && onCancel}
        <Button
          type="submit"
          size="default"
          className={`${showCancel ? "" : "w-full"} bg-green-600 font-semibold text-white shadow-sm hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700`}
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

/**
 * Modal shown during submit:
 *  - "validating" state: spinner placeholder while the LLM checks similarity.
 *  - "matches" state: green similarity bars + hover-revealed Pro/Contra votes
 *    on existing proposals + footer with cancel + "add with Pro" / "add with Contra".
 */
function DuplicateMatchesModal({
  form,
  projectId,
}: {
  form: ReturnType<typeof useProposalForm>;
  projectId: string;
}) {
  const {
    t, modalState, modalOpen, duplicateMatches,
    confirmSubmitWithVote, cancelDuplicateModal, existingById,
  } = form;
  const [voting, setVoting] = useState<string | null>(null);
  // value of cast vote per proposal id, used both to gate UI and to show the badge
  const [votedDetails, setVotedDetails] = useState<Map<string, 1 | -1>>(new Map());
  // When the user picks "add my own anyway", we show an inline confirmation
  // before actually submitting. `null` = no confirmation pending.
  const [pendingAddVote, setPendingAddVote] = useState<"1" | "-1" | null>(null);

  useEffect(() => {
    if (!modalOpen) {
      setVotedDetails(new Map());
      setPendingAddVote(null);
      setVoting(null);
    }
  }, [modalOpen]);

  async function handleVote(proposalId: string, value: 1 | -1) {
    setVoting(`${proposalId}:${value}`);
    try {
      const result = await castVote(proposalId, value, projectId, getCsrfTokenClient());
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(value === 1 ? t("vote.proCast") : t("vote.contraCast"));
        setVotedDetails((prev) => {
          const next = new Map(prev);
          next.set(proposalId, value);
          return next;
        });
      }
    } catch {
      toast.error(t("vote.failed"));
    } finally {
      setVoting(null);
    }
  }

  const hasVoted = votedDetails.size > 0;

  if (!modalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label={t("duplicateModal.cancel")}
        onClick={modalState === "saving" ? undefined : cancelDuplicateModal}
        tabIndex={-1}
        disabled={modalState === "saving"}
      />

      <div className="relative z-30 w-[min(90vw,720px)] space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
        {modalState === "validating" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-medium" id="duplicate-modal-title">
              {t("duplicateModal.validating")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("duplicateModal.validatingHint")}
            </p>
          </div>
        ) : modalState === "saving" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" aria-hidden="true" />
            <p className="text-sm font-medium" id="duplicate-modal-title">
              {t("duplicateModal.saving")}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h3 id="duplicate-modal-title" className="text-lg font-semibold">
                {t("duplicateModal.title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("duplicateModal.description")}
              </p>
            </div>

            <div className="max-h-[320px] space-y-4 overflow-y-auto pr-2" role="list">
              {duplicateMatches.map((m) => {
                const existing = existingById.get(m.id);
                if (!existing) return null;
                const pct = Math.max(0, Math.min(100, m.similarity));
                const gradient = `linear-gradient(90deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.25) ${pct}%, transparent ${pct}%)`;
                const votedValue = votedDetails.get(m.id);
                const isVoted = votedValue !== undefined;
                return (
                  <div
                    key={m.id}
                    role="listitem"
                    className="group relative overflow-hidden rounded-lg border border-border/70 bg-muted/40 p-3 transition hover:border-primary/60 hover:bg-primary/5"
                  >
                    <div
                      className="pointer-events-none absolute inset-0 opacity-30"
                      aria-hidden="true"
                      style={{ background: gradient }}
                    />
                    <div className="relative flex items-start gap-3">
                      <div className="flex-1 space-y-1 pr-28">
                        <div className="text-sm font-semibold">
                          <a
                            href={`/projects/${projectId}#proposal-${m.id}`}
                            className="hover:underline"
                            onClick={cancelDuplicateModal}
                          >
                            {existing.title}
                          </a>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {m.explanation && (
                            <span className="leading-relaxed">{m.explanation}</span>
                          )}
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200">
                            {t("similarity.score", { score: pct })}
                          </span>
                        </div>
                      </div>
                      {isVoted ? (
                        <div
                          className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
                            votedValue === 1
                              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                              : "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200"
                          }`}
                          aria-label={
                            votedValue === 1
                              ? t("duplicateModal.votedProBadge")
                              : t("duplicateModal.votedContraBadge")
                          }
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          {votedValue === 1 ? t("vote.pro") : t("vote.contra")}
                        </div>
                      ) : (
                        <div className="absolute right-2 top-2 flex overflow-hidden rounded-md border border-border/70 bg-secondary opacity-0 shadow-sm transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <button
                            type="button"
                            aria-label={t("vote.pro")}
                            disabled={voting !== null}
                            onClick={() => handleVote(m.id, 1)}
                            className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-none border-r border-border/60 bg-secondary px-3 text-xs font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-green-50 hover:text-green-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-green-950"
                          >
                            {voting === `${m.id}:1` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={t("vote.contra")}
                            disabled={voting !== null}
                            onClick={() => handleVote(m.id, -1)}
                            className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-none bg-secondary px-3 text-xs font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 dark:hover:bg-rose-950"
                          >
                            {voting === `${m.id}:-1` ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {pendingAddVote !== null ? (
              <div className="space-y-3" aria-live="polite">
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/60">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <div className="text-sm text-amber-900 dark:text-amber-100">
                    <p className="font-medium">{t("duplicateModal.confirmAddTitle")}</p>
                    <p className="mt-1 text-xs">
                      {t("duplicateModal.confirmAddBody", {
                        voteLabel: pendingAddVote === "1" ? t("vote.pro") : t("vote.contra"),
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingAddVote(null)}
                    className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {t("duplicateModal.confirmAddBack")}
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmSubmitWithVote(pendingAddVote)}
                    className={`inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium text-white shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      pendingAddVote === "1"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-amber-600 hover:bg-amber-700"
                    }`}
                  >
                    {pendingAddVote === "1" ? (
                      <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ThumbsDown className="h-4 w-4" aria-hidden="true" />
                    )}
                    {t("duplicateModal.confirmAddYes")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingAddVote("-1")}
                    className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-rose-200 bg-rose-50/50 px-3 py-2 text-xs font-medium text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/60"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("duplicateModal.addAnywayContra")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAddVote("1")}
                    className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs font-medium text-amber-800 transition-colors hover:border-amber-300 hover:bg-amber-100/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/60"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("duplicateModal.addAnywayPro")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={cancelDuplicateModal}
                  className="inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                  autoFocus
                >
                  {hasVoted ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      {t("duplicateModal.closeAfterVote")}
                    </>
                  ) : (
                    t("duplicateModal.close")
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Sheet drawer (side="left") for the proposal form — works on mobile and desktop.
 * Drawer auto-closes the moment validation begins, so the duplicate-detection
 * modal becomes the primary surface during/after the similarity check.
 */
export function ProposalForm(props: ProposalFormProps) {
  const form = useProposalForm(props);
  const [open, setOpen] = useState(false);
  const { state, t, resetForm, modalOpen } = form;

  // Close drawer as soon as the validation/matches modal takes over.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing drawer visibility to modal state; can't be derived in render because Sheet is a controlled child.
    if (modalOpen) setOpen(false);
  }, [modalOpen]);

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
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="sm">
            <span className="sm:hidden">{form.t("proposalForm.newProposalShort")}</span>
            <span className="hidden sm:inline">{form.t("proposalForm.newProposal")}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader className="shrink-0">
            <SheetTitle>{form.t("proposalForm.title")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 px-4 pb-4">
            <ProposalFormFields form={form} showCancel onCancel={
              <SheetClose asChild>
                <Button type="button" variant="outline" size="sm" disabled={form.isPending}>
                  {form.t("common.cancel")}
                </Button>
              </SheetClose>
            } />
          </div>
        </SheetContent>
      </Sheet>
      <DuplicateMatchesModal form={form} projectId={form.projectId} />
    </>
  );
}
