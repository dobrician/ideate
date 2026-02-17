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
        <Button variant="ghost" size="sm" className="min-h-[44px] text-muted-foreground" title={t("comments.open")}>
          <MessageSquare className="mr-1 h-4 w-4" />
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">{commentCount}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-left">
            {t("comments.title")}: {proposalTitle}
          </SheetTitle>
          <SheetDescription className="text-left">
            {t("comments.sheetDescription")}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-2 h-[calc(100dvh-8rem)] px-2 pb-[env(safe-area-inset-bottom)] sm:mt-4 sm:h-[calc(100vh-10rem)] sm:px-4">
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
