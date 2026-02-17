"use client";

import { MessageSquare } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { useCommentPoll } from "@/lib/use-comment-poll";
import { CommentThread } from "./comment-thread";
import type { Comment } from "@/lib/comment-utils";

interface ProjectCommentsProps {
  projectId: string;
  comments: Comment[];
  currentUserId?: string;
}

export function ProjectComments({ projectId, comments, currentUserId }: ProjectCommentsProps) {
  const { t } = useLocale();
  useCommentPoll();

  return (
    <div data-rsc-content className="border-t pt-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <MessageSquare className="h-5 w-5" />
        {t("comments.projectDiscussion")}
        <span className="text-sm font-normal text-muted-foreground">
          ({comments.length})
        </span>
      </h2>
      <div className="h-[min(400px,60vh)] sm:h-[min(400px,50vh)]">
        <CommentThread
          comments={comments}
          hiddenFields={{ projectId }}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}
