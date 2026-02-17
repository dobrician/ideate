"use client";

import { useMemo, useState } from "react";
import {
  Accordion,
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
import { useVoteStream } from "@/lib/use-vote-stream";
import { Trash2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { formatDate } from "@/lib/utils";
import type { Comment } from "@/components/comment-thread";

interface ProposalWithStats {
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
}

interface ProposalListProps {
  proposals: ProposalWithStats[];
  projectId: string;
  currentUserId: string;
  isAdmin: boolean;
}

export function ProposalList({
  proposals,
  projectId,
  currentUserId,
  isAdmin,
}: ProposalListProps) {
  const { t } = useLocale();
  const voteUpdates = useVoteStream(projectId);

  const sorted = useMemo(() => {
    return [...proposals].sort((a, b) => {
      const aLive = voteUpdates.get(a.id);
      const bLive = voteUpdates.get(b.id);
      const aNet = (aLive?.upvotes ?? a.upvotes) - (aLive?.downvotes ?? a.downvotes);
      const bNet = (bLive?.upvotes ?? b.upvotes) - (bLive?.downvotes ?? b.downvotes);
      if (bNet !== aNet) return bNet - aNet;
      const aContra = aLive?.downvotes ?? a.downvotes;
      const bContra = bLive?.downvotes ?? b.downvotes;
      return aContra - bContra;
    });
  }, [proposals, voteUpdates]);

  const maxTotalVotes = useMemo(() => {
    let max = 0;
    for (const p of proposals) {
      const live = voteUpdates.get(p.id);
      const total = (live?.upvotes ?? p.upvotes) + (live?.downvotes ?? p.downvotes);
      max = Math.max(max, total);
    }
    return max;
  }, [proposals, voteUpdates]);

  if (proposals.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="rounded-full bg-muted p-3">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("proposals.noProposals")}
        </p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" className="space-y-2">
      {sorted.map((proposal) => {
        const live = voteUpdates.get(proposal.id);
        return (
          <ProposalItem
            key={proposal.id}
            proposal={proposal}
            projectId={projectId}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            liveUpvotes={live?.upvotes}
            liveDownvotes={live?.downvotes}
            maxTotalVotes={maxTotalVotes}
          />
        );
      })}
    </Accordion>
  );
}

function ProposalItem({
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
  const halfWidth = maxTotalVotes > 0 ? 50 / maxTotalVotes : 0;
  const greenWidth = Math.round(upvotes * halfWidth);
  const redWidth = Math.round(downvotes * halfWidth);

  async function handleDelete() {
    setIsDeleting(true);
    const result = await deleteProposal(proposal.id, projectId, getCsrfTokenClient());
    if (result?.error) {
      toast.error(result.error);
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
      className="rounded-lg border bg-card transition-shadow duration-200 data-[state=open]:shadow-md"
    >
      <AccordionTrigger className="relative overflow-hidden py-3 hover:no-underline">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {redWidth > 0 && (
            <div
              className="absolute right-1/2 top-0 h-full bg-gradient-to-l from-red-500/20 to-red-500/5 transition-all duration-300"
              style={{ width: `${redWidth}%` }}
            />
          )}
          {greenWidth > 0 && (
            <div
              className="absolute left-1/2 top-0 h-full bg-gradient-to-r from-green-500/20 to-green-500/5 transition-all duration-300"
              style={{ width: `${greenWidth}%` }}
            />
          )}
        </div>
        <div className="relative z-10 flex w-full flex-col gap-2 px-4 pr-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1 text-left">
            <span className="font-medium">{proposal.title}</span>
            <span className="ml-2 inline-flex max-w-[8rem] text-xs text-muted-foreground sm:max-w-none">
              <span className="truncate">{t("proposals.by")} {proposal.authorName}</span>
            </span>
          </div>
          <div
            className="flex min-w-0 items-center gap-2"
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
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 px-4 pb-2">
          {displayText && (
            <MarkdownRenderer content={displayText} className="text-sm text-muted-foreground" />
          )}

          {proposal.summary &&
            proposal.description &&
            proposal.summary !== proposal.description && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
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
                    className="h-6 min-h-[44px] px-2 text-xs text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-300"
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
