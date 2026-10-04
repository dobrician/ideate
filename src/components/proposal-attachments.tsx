"use client";

import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AttachmentUpload } from "@/components/attachment-upload";
import { useLocale } from "@/lib/use-locale";
import type { ProposalWithStats } from "@/components/proposal-item";

/** Reveal proposal files independently of the expanded description. */
export function ProposalAttachments({ proposal, canEdit }: { proposal: ProposalWithStats; canEdit: boolean }) {
  const { t } = useLocale();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="min-h-11 min-w-11 gap-1 px-1 has-[>svg]:px-1 sm:gap-1.5 sm:px-3 sm:has-[>svg]:px-2.5 text-muted-foreground" aria-label={t("attachments.title")}>
          <Paperclip className="size-4" />
          {proposal.attachments.length > 0 && <span className="text-xs">{proposal.attachments.length}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("attachments.title")}</SheetTitle>
          <SheetDescription>{proposal.title}</SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <AttachmentUpload proposalId={proposal.id} attachments={proposal.attachments} canEdit={canEdit} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
