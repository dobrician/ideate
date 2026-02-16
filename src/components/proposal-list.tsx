"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { VoteButtons } from "@/components/vote-buttons";
import { VoteBar } from "@/components/vote-bar";
import { DiscussionSheet } from "@/components/discussion-sheet";
import { deleteProposal } from "@/app/projects/[id]/proposals/actions";
import { useVoteStream } from "@/lib/use-vote-stream";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";

interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  userId: string | null;
  userEmail?: string;
  userName?: string;
  createdAt: Date | null;
}

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

/**
 * Accordion-based proposal list with real-time voting via SSE
 */
export function ProposalList({
  proposals,
  projectId,
  currentUserId,
  isAdmin,
}: ProposalListProps) {
  const { t } = useLocale();
  const voteUpdates = useVoteStream(projectId);

  if (proposals.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t("proposals.noProposals")}
      </p>
    );
  }

  return (
    <Accordion type="multiple" className="space-y-2">
      {proposals.map((proposal) => {
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
}: {
  proposal: ProposalWithStats;
  projectId: string;
  currentUserId: string;
  isAdmin: boolean;
  liveUpvotes?: number;
  liveDownvotes?: number;
}) {
  const { t } = useLocale();
  const [showFull, setShowFull] = useState(false);
  const canDelete = proposal.userId === currentUserId || isAdmin;

  const upvotes = liveUpvotes ?? proposal.upvotes;
  const downvotes = liveDownvotes ?? proposal.downvotes;

  async function handleDelete() {
    if (!confirm(t("proposals.deleteConfirm"))) return;
    const result = await deleteProposal(proposal.id, projectId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(t("proposals.deleted"));
    }
  }

  const displayText = showFull
    ? proposal.description
    : proposal.summary || proposal.description;

  return (
    <AccordionItem
      value={proposal.id}
      className="rounded-lg border bg-card px-4"
    >
      <AccordionTrigger className="py-3 hover:no-underline">
        <div className="flex w-full items-center justify-between pr-2">
          <div className="min-w-0 flex-1 text-left">
            <span className="font-medium">{proposal.title}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              by {proposal.authorName}
            </span>
          </div>
          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <VoteButtons
              proposalId={proposal.id}
              projectId={projectId}
              upvotes={upvotes}
              downvotes={downvotes}
              userVote={proposal.userVote}
            />
            <DiscussionSheet
              proposalId={proposal.id}
              projectId={projectId}
              proposalTitle={proposal.title}
              comments={proposal.comments}
              commentCount={proposal.commentCount}
            />
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pb-2">
          <VoteBar upvotes={upvotes} downvotes={downvotes} />

          {displayText && (
            <div className="whitespace-pre-wrap text-sm text-muted-foreground">
              {displayText}
            </div>
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
                ? new Date(proposal.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : ""}
            </span>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                onClick={handleDelete}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                {t("proposals.delete")}
              </Button>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
