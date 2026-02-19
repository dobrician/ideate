"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, ChevronRight, Reply } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  formatTimeAgo,
  getInitials,
  avatarColor,
  MAX_THREAD_DEPTH,
} from "@/lib/comment-utils";
import type { Comment, CommentNode } from "@/lib/comment-utils";

export function ChatBubble({
  comment,
  isOwn,
  showAvatar,
  onReply,
}: {
  comment: Comment;
  isOwn: boolean;
  showAvatar: boolean;
  onReply?: () => void;
}) {
  const { t } = useLocale();
  const displayName = comment.userName || comment.userEmail || t("common.anonymous");
  // Defer time-ago computation to avoid hydration mismatch (Date.now() differs
  // between server and client). Render empty string during SSR+hydration.
  const [timeAgo, setTimeAgo] = useState("");
  useEffect(() => {
    if (comment.createdAt) {
      setTimeAgo(formatTimeAgo(comment.createdAt, t));
    }
  }, [comment.createdAt, t]);
  const initials = getInitials(displayName);
  const colorClass = avatarColor(comment.userId);

  return (
    <div className={`group/bubble flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {showAvatar ? (
        <Avatar size="sm" className="mt-1 shrink-0">
          {comment.avatarUrl && (
            <AvatarImage src={comment.avatarUrl} alt={displayName} />
          )}
          <AvatarFallback className={`${colorClass} text-white`}>{initials}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-6 shrink-0" />
      )}
      <div className={`min-w-0 max-w-[85%] sm:max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
        {showAvatar && (
          <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? "justify-end" : ""}`}>
            <span className="text-xs font-medium text-foreground">
              {isOwn ? t("comments.you") : displayName}
            </span>
            {timeAgo && <span className="text-xs text-muted-foreground">&middot; {timeAgo}</span>}
          </div>
        )}
        <div
          className={`overflow-hidden break-words rounded-2xl px-3 py-2 text-sm ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          }`}
        >
          <MarkdownRenderer content={comment.content} simple />
        </div>
        <div className={`flex items-center gap-2 mt-0.5 ${isOwn ? "justify-end" : ""}`}>
          {!showAvatar && timeAgo && (
            <span
              data-testid="hover-timestamp"
              className={`text-[10px] text-muted-foreground block opacity-0 transition-opacity group-hover/bubble:opacity-100 active:opacity-100`}
            >
              {timeAgo}
            </span>
          )}
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover/bubble:opacity-100 active:opacity-100 transition-opacity flex items-center gap-0.5"
            >
              <Reply className="h-3 w-3" />
              {t("comments.reply")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ThreadedCommentNode({
  node,
  depth,
  currentUserId,
  onReply,
}: {
  node: CommentNode;
  depth: number;
  currentUserId?: string;
  onReply: (parentId: string) => void;
}) {
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const isOwn = !!currentUserId && node.userId === currentUserId;
  const canNest = depth < MAX_THREAD_DEPTH;
  const hasChildren = node.children.length > 0;

  return (
    <div className={depth > 0 ? "ml-4 sm:ml-6 border-l-2 border-muted pl-2" : ""}>
      <div className={depth > 0 ? "pt-1" : ""}>
        <ChatBubble
          comment={node}
          isOwn={isOwn}
          showAvatar={true}
          onReply={() => onReply(canNest ? node.id : (node.parentId || node.id))}
        />
      </div>
      {hasChildren && depth >= MAX_THREAD_DEPTH - 1 && !collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="mt-1 ml-8 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ChevronDown className="h-3 w-3" />
          {t("comments.collapseReplies")}
        </button>
      )}
      {hasChildren && collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mt-1 ml-8 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ChevronRight className="h-3 w-3" />
          {t("comments.showMoreReplies", { count: node.children.length })}
        </button>
      )}
      {hasChildren && !collapsed && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <ThreadedCommentNode
              key={child.id}
              node={child}
              depth={canNest ? depth + 1 : depth}
              currentUserId={currentUserId}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}
