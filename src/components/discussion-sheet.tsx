"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { useCommentPoll } from "@/lib/use-comment-poll";
import { CommentThread } from "./comment-thread";
import type { Comment } from "./comment-thread";

interface DiscussionSheetProps {
  proposalId: string;
  projectId: string;
  proposalTitle: string;
  comments: Comment[];
  commentCount: number;
  currentUserId?: string;
}

export function DiscussionSheet({
  proposalId,
  projectId,
  proposalTitle,
  comments,
  commentCount,
  currentUserId,
}: DiscussionSheetProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  useCommentPoll(15_000, open);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-label={t("comments.open")}>
          <MessageSquare className="mr-1 h-4 w-4" />
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">{commentCount}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="shrink-0">
          <SheetTitle className="text-left">
            {t("comments.title")}: {proposalTitle}
          </SheetTitle>
          <SheetDescription className="text-left text-xs">
            {t("comments.sheetDescription")}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-2 flex-1 overflow-hidden px-2 pb-[max(env(safe-area-inset-bottom),var(--kb-inset,0px))] sm:mt-3 sm:px-4">
          <CommentThread
            comments={comments}
            hiddenFields={{ proposalId }}
            currentUserId={currentUserId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
