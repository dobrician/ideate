"use client";
import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, Loader2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import type { useProposalForm } from "@/lib/use-proposal-form";
import { castVote } from "@/app/projects/[id]/proposals/actions";

/** Review similar ideas before creating a duplicate. */
export function DuplicateMatchesModal({
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
