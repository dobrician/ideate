"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { CommentThread } from "./comment-thread";
import type { Comment } from "./comment-thread";

interface DiscussionSheetProps {
  proposalId: string;
  projectId: string;
  proposalTitle: string;
  comments: Comment[];
  commentCount: number;
}

export function DiscussionSheet({
  proposalId,
  projectId,
  proposalTitle,
  comments,
  commentCount,
}: DiscussionSheetProps) {
  const { t } = useLocale();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground" title={t("comments.open")}>
          <MessageSquare className="mr-1 h-4 w-4" />
          <span className="text-sm">{commentCount}</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-left">
            {t("comments.title")}: {proposalTitle}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 h-[calc(100vh-10rem)] p-4">
          <CommentThread
            comments={comments}
            hiddenFields={{ proposalId }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
