"use client";

import { useState } from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { VoteButtons } from "@/components/vote-buttons";
import { DiscussionSheet } from "@/components/discussion-sheet";
import { deleteProposal } from "@/app/projects/[id]/proposals/actions";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { ProposalAttachments } from "@/components/proposal-attachments";
import { formatDate } from "@/lib/utils";
import type { Comment } from "@/lib/comment-utils";

export interface AttachmentInfo {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ProposalWorkflowInfo {
  currentStageName: string;
  status: "active" | "completed" | "rejected";
  stageIndex: number;
  totalStages: number;
}

export interface ProposalWithStats {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  userId: string | null;
  createdAt: Date | null;
  upvotes: number;
  downvotes: number;
  userVote: number | null;
  commentCount: number;
  comments: Comment[];
  authorName: string;
  attachments: AttachmentInfo[];
  tags: { id: string; name: string }[];
  workflowState?: ProposalWorkflowInfo | null;
}

/** Render a readable idea summary and independent voting controls. */
export function ProposalItem({
  proposal,
  projectId,
  currentUserId,
  isAdmin,
  liveUpvotes,
  liveDownvotes,
  maxTotalVotes,
  guestRedirect,
  readOnly = false,
  isPreviewActive = false,
  onPreviewActivate,
}: {
  proposal: ProposalWithStats;
  projectId: string;
  currentUserId: string;
  isAdmin: boolean;
  liveUpvotes?: number;
  liveDownvotes?: number;
  maxTotalVotes: number;
  guestRedirect?: string;
  readOnly?: boolean;
  isPreviewActive?: boolean;
  onPreviewActivate?: () => void;
}) {
  const { t, locale } = useLocale();
  const [showFull, setShowFull] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete = !readOnly && (proposal.userId === currentUserId || isAdmin);

  const upvotes = liveUpvotes ?? proposal.upvotes;
  const downvotes = liveDownvotes ?? proposal.downvotes;
  const totalVotes = upvotes + downvotes;
  const voteUnit = maxTotalVotes > 0 ? 100 / maxTotalVotes : 0;
  // No gradient when this proposal has zero total votes
  const greenWidth = totalVotes > 0 ? Math.round(upvotes * voteUnit) : 0;
  const redWidth = totalVotes > 0 ? Math.round(downvotes * voteUnit) : 0;

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteProposal(proposal.id, projectId, getCsrfTokenClient());
    if (result?.error) {
      toast.error(t(result.error));
      setIsDeleting(false);
      setDeleteOpen(false);
    } else {
      toast.success(t("proposals.deleted"));
      setDeleteOpen(false);
    }
  }

  const displayText = showFull
    ? proposal.description
    : proposal.summary || proposal.description;

  return (
    <AccordionItem
      value={proposal.id}
      data-preview-active={isPreviewActive}
      onPointerMove={(event) => { if (event.pointerType === "mouse") onPreviewActivate?.(); }}
      onFocusCapture={() => onPreviewActivate?.()}
      className="group/proposal relative rounded-lg border bg-transparent transition-shadow duration-200 data-[state=open]:shadow-md after:pointer-events-none after:absolute after:-inset-x-px after:top-full after:h-1 after:rounded-b-lg after:border after:border-t-0 after:border-border after:bg-background after:opacity-0 after:-translate-y-1 after:transition-[transform,opacity] after:duration-300 after:ease-[cubic-bezier(.22,1.15,.36,1)] has-[[data-slot=accordion-trigger]:hover]:after:opacity-100 has-[[data-slot=accordion-trigger]:hover]:after:translate-y-0 has-[[data-slot=accordion-trigger]:hover]:after:delay-500 data-[state=open]:after:hidden motion-reduce:after:transition-none"
    >
      <div className="px-4 py-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
          <div className="min-w-0 flex-1">
            <AccordionTrigger showIndicator={false} className="cursor-pointer min-h-11 items-center gap-3 py-0 hover:no-underline">
              <span className="block min-w-0 break-words line-clamp-2 text-sm font-semibold leading-snug" title={proposal.title}>{proposal.title}</span>
              <span className="sr-only">{t("proposals.by")} {proposal.authorName}</span>
            </AccordionTrigger>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="hidden text-xs text-muted-foreground group-data-[state=open]/proposal:block">{proposal.authorName}</span>
            <div className="flex items-center justify-end gap-1">
            <VoteButtons proposalId={proposal.id} projectId={projectId}
              upvotes={upvotes} downvotes={downvotes} userVote={proposal.userVote}
              guestRedirect={guestRedirect} readOnly={readOnly} />
            {!readOnly && <DiscussionSheet proposalId={proposal.id} projectId={projectId}
              proposalTitle={proposal.title} comments={proposal.comments}
              commentCount={proposal.commentCount} currentUserId={currentUserId} guestRedirect={guestRedirect} />}
            {(proposal.attachments.length > 0 || canDelete) && <ProposalAttachments proposal={proposal} canEdit={canDelete} />}
            </div>
          </div>
        </div>
        {(proposal.summary || proposal.description) && (
          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(.22,1.15,.36,1)] group-data-[state=open]/proposal:hidden motion-reduce:transition-none ${isPreviewActive ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden"><p className="min-h-12 pb-1 text-sm leading-relaxed text-muted-foreground">{proposal.summary || proposal.description}</p></div>
          </div>
        )}
        <div className="relative mt-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {greenWidth > 0 && <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/70 transition-all duration-300" style={{ width: `${greenWidth}%` }} />}
          {redWidth > 0 && <div className="absolute inset-y-0 right-0 rounded-full bg-rose-400/70 transition-all duration-300" style={{ width: `${redWidth}%` }} />}
        </div>
      </div>
      <AccordionContent>
        <div className="space-y-2 border-t px-4 pt-3">
          {(proposal.tags.length > 0 || proposal.workflowState) && (
            <div className="flex flex-wrap items-center gap-1">
              {proposal.workflowState && <Badge variant="outline">{proposal.workflowState.currentStageName} ({proposal.workflowState.stageIndex + 1}/{proposal.workflowState.totalStages})</Badge>}
              {proposal.tags.map(tag => <Badge key={tag.id} variant="secondary">{tag.name}</Badge>)}
            </div>
          )}
          {displayText && (
            <MarkdownRenderer content={displayText} className="text-sm text-muted-foreground prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1 prose-ul:my-2 prose-ol:my-2" />
          )}

          {proposal.summary &&
            proposal.description &&
            proposal.summary !== proposal.description && (
              <Button
                variant="link"
                size="sm"
                className="px-0 text-xs"
                onClick={() => setShowFull(!showFull)}
              >
                {showFull ? t("proposals.showSummary") : t("proposals.showFull")}
              </Button>
            )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {proposal.createdAt
                ? formatDate(proposal.createdAt, locale, "short")
                : ""}
            </span>
            {canDelete && (
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                    title={t("proposals.delete")}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    {t("proposals.delete")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("proposals.delete")}</DialogTitle>
                    <DialogDescription>{t("proposals.deleteConfirm")}</DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
                      {t("common.cancel")}
                    </Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting ? t("deleteProject.deleting") : t("common.delete")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
