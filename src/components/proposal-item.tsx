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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { deleteProposal } from "@/app/projects/[id]/proposals/actions";
import { Badge } from "@/components/ui/badge";
import { Trash2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { AttachmentUpload } from "@/components/attachment-upload";
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

export function ProposalItem({
  proposal,
  projectId,
  currentUserId,
  isAdmin,
  liveUpvotes,
  liveDownvotes,
  maxTotalVotes,
}: {
  proposal: ProposalWithStats;
  projectId: string;
  currentUserId: string;
  isAdmin: boolean;
  liveUpvotes?: number;
  liveDownvotes?: number;
  maxTotalVotes: number;
}) {
  const { t, locale } = useLocale();
  const [showFull, setShowFull] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete = proposal.userId === currentUserId || isAdmin;

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
      className="overflow-hidden rounded-lg border bg-card transition-shadow duration-200 data-[state=open]:shadow-md"
    >
      <AccordionTrigger className="py-3 hover:no-underline">
        <div className="flex min-w-0 flex-1 flex-col gap-1 px-2 sm:px-4 sm:pr-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1 overflow-hidden rounded text-left">
              {totalVotes > 0 && (
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                  {greenWidth > 0 && (
                    <div
                      className="absolute left-0 top-0 h-full transition-all duration-300"
                      style={{ width: `${greenWidth}%`, backgroundColor: "rgba(120, 149, 100, 0.18)" }}
                    />
                  )}
                  {redWidth > 0 && (
                    <div
                      className="absolute right-0 top-0 h-full transition-all duration-300"
                      style={{ width: `${redWidth}%`, backgroundColor: "rgba(180, 110, 85, 0.18)" }}
                    />
                  )}
                </div>
              )}
              <div className="relative z-10 px-2 py-1">
                <span className="line-clamp-2 break-words font-medium" title={proposal.title}>{proposal.title}</span>
                <span className="block truncate text-xs text-muted-foreground" title={`${t("proposals.by")} ${proposal.authorName}`}>
                  {t("proposals.by")} {proposal.authorName}
                </span>
              </div>
            </div>
          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div title={t("vote.approvalRatio")}>
                    <VoteButtons
                      proposalId={proposal.id}
                      projectId={projectId}
                      upvotes={upvotes}
                      downvotes={downvotes}
                      userVote={proposal.userVote}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t("vote.approvalRatio")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DiscussionSheet
              proposalId={proposal.id}
              projectId={projectId}
              proposalTitle={proposal.title}
              comments={proposal.comments}
              commentCount={proposal.commentCount}
              currentUserId={currentUserId}
            />
          </div>
          </div>
          {(proposal.description || proposal.summary) && (
            <p className="min-w-0 truncate text-left text-xs text-muted-foreground/70">
              {proposal.summary || proposal.description}
            </p>
          )}
          {proposal.attachments.length > 0 && (
            <span className="inline-flex items-center gap-1 text-left text-[11px] text-muted-foreground/60">
              <Paperclip className="h-3 w-3" />
              {proposal.attachments.length}
            </span>
          )}
          {(proposal.tags.length > 0 || proposal.workflowState) && (
            <div className="flex flex-wrap gap-1 text-left">
              {proposal.workflowState && (
                <Badge
                  variant="outline"
                  className={`px-1.5 py-0 text-[10px] ${
                    proposal.workflowState.status === "completed"
                      ? "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400"
                      : proposal.workflowState.status === "rejected"
                        ? "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400"
                        : "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400"
                  }`}
                >
                  {proposal.workflowState.currentStageName} ({proposal.workflowState.stageIndex + 1}/{proposal.workflowState.totalStages})
                </Badge>
              )}
              {proposal.tags.map((tag) => (
                <Badge key={tag.id} variant="secondary" className="px-1.5 py-0 text-[10px]">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
          <span className="inline-flex items-center gap-1 text-left text-xs font-medium text-primary/80 hover:text-primary">
            {t("proposals.details")} ↓
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 px-2 pb-2 sm:px-4">
          {displayText && (
            <MarkdownRenderer content={displayText} className="text-sm text-muted-foreground" />
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

          <AttachmentUpload
            proposalId={proposal.id}
            attachments={proposal.attachments}
            canEdit={proposal.userId === currentUserId || isAdmin}
          />

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
