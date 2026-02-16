"use client";

import { MessageSquare } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { CommentThread } from "./comment-thread";
import type { Comment } from "./comment-thread";

interface ProjectCommentsProps {
  projectId: string;
  comments: Comment[];
}

export function ProjectComments({ projectId, comments }: ProjectCommentsProps) {
  const { t } = useLocale();

  return (
    <div className="border-t p-4 pt-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <MessageSquare className="h-5 w-5" />
        {t("comments.projectDiscussion")}
        <span className="text-sm font-normal text-muted-foreground">
          ({comments.length})
        </span>
      </h2>
      <CommentThread
        comments={comments}
        hiddenFields={{ projectId }}
      />
    </div>
  );
}
