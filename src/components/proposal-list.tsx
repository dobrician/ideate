"use client";

import { useMemo, useState } from "react";
import { Accordion } from "@/components/ui/accordion";
import { useVoteStream } from "@/lib/use-vote-stream";
import { Lightbulb } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { ProposalItem } from "@/components/proposal-item";
import type { ProposalWithStats } from "@/components/proposal-item";

interface ProposalListProps {
  proposals: ProposalWithStats[];
  projectId: string;
  currentUserId: string;
  isAdmin: boolean;
  /** When set, vote buttons + comment forms redirect unauth users to login pointing here. */
  guestRedirect?: string;
  readOnly?: boolean;
  sort?: "votes" | "newest" | "oldest" | "comments" | "controversy";
}

/** Show vote-ranked ideas, preserving the selected server sort when requested. */
export function ProposalList({
  proposals,
  projectId,
  currentUserId,
  isAdmin,
  guestRedirect,
  sort = "votes",
  readOnly = false,
}: ProposalListProps) {
  const { t } = useLocale();
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const voteUpdates = useVoteStream(projectId);

  const maxTotalVotes = useMemo(() => {
    let max = 0;
    for (const p of proposals) {
      const live = voteUpdates.get(p.id);
      const total = (live?.upvotes ?? p.upvotes) + (live?.downvotes ?? p.downvotes);
      max = Math.max(max, total);
    }
    return max;
  }, [proposals, voteUpdates]);

  const sorted = useMemo(() => {
    if (sort !== "votes") return proposals;
    return [...proposals].sort((a, b) => {
      const aLive = voteUpdates.get(a.id);
      const bLive = voteUpdates.get(b.id);
      const aNet = (aLive?.upvotes ?? a.upvotes) - (aLive?.downvotes ?? a.downvotes);
      const bNet = (bLive?.upvotes ?? b.upvotes) - (bLive?.downvotes ?? b.downvotes);
      if (bNet !== aNet) return bNet - aNet;
      // Tiebreak: newest first (createdAt DESC)
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [proposals, voteUpdates, sort]);

  const activePreviewId = sorted.some(p => p.id === selectedPreviewId) ? selectedPreviewId : sorted[0]?.id;

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
            isPreviewActive={proposal.id === activePreviewId}
            onPreviewActivate={() => setSelectedPreviewId(proposal.id)}
            projectId={projectId}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            liveUpvotes={live?.upvotes}
            liveDownvotes={live?.downvotes}
            maxTotalVotes={maxTotalVotes}
            readOnly={readOnly}
            guestRedirect={guestRedirect}
          />
        );
      })}
    </Accordion>
  );
}
