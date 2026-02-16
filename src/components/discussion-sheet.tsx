"use client";

import { useActionState, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addComment } from "@/app/projects/[id]/proposals/actions";
import { MessageSquare, Reply, CornerDownRight } from "lucide-react";
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

interface DiscussionSheetProps {
  proposalId: string;
  projectId: string;
  proposalTitle: string;
  comments: Comment[];
  commentCount: number;
}

interface CommentTreeNode extends Comment {
  children: CommentTreeNode[];
}

/**
 * Build a tree structure from flat comment list
 */
function buildCommentTree(comments: Comment[]): CommentTreeNode[] {
  const map = new Map<string, CommentTreeNode>();
  const roots: CommentTreeNode[] = [];

  for (const c of comments) {
    map.set(c.id, { ...c, children: [] });
  }

  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Single comment with reply capability
 */
function CommentNode({
  comment,
  depth,
  proposalId,
  projectId,
}: {
  comment: CommentTreeNode;
  depth: number;
  proposalId: string;
  projectId: string;
}) {
  const { t } = useLocale();
  const [replying, setReplying] = useState(false);
  const [state, formAction, isPending] = useActionState(addComment, null);

  if (state?.success && replying) {
    toast.success(t("comments.replyPosted"));
    setReplying(false);
  }
  if (state?.error) {
    toast.error(state.error);
  }

  const maxDepth = 3;
  const displayName = comment.userName || comment.userEmail || "Anonymous";
  const timeAgo = comment.createdAt
    ? formatTimeAgo(comment.createdAt, t)
    : "";

  return (
    <div className={depth > 0 ? "ml-4 border-l-2 border-muted pl-3" : ""}>
      <div className="py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{displayName}</span>
          {timeAgo && <span>{timeAgo}</span>}
        </div>
        <p className="mt-1 text-sm whitespace-pre-wrap">{comment.content}</p>
        {depth < maxDepth && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-6 px-2 text-xs text-muted-foreground"
            onClick={() => setReplying(!replying)}
          >
            <Reply className="mr-1 h-3 w-3" />
            {t("comments.reply")}
          </Button>
        )}

        {replying && (
          <form action={formAction} className="mt-2 space-y-2">
            <input type="hidden" name="proposalId" value={proposalId} />
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="parentId" value={comment.id} />
            <div className="flex items-start gap-2">
              <CornerDownRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <Textarea
                name="content"
                placeholder={t("comments.replyPlaceholder")}
                rows={2}
                required
                maxLength={2000}
                disabled={isPending}
                className="min-h-[60px]"
              />
            </div>
            {state?.error && (
              <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? t("comments.posting") : t("comments.reply")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReplying(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        )}
      </div>

      {comment.children.map((child) => (
        <CommentNode
          key={child.id}
          comment={child}
          depth={depth + 1}
          proposalId={proposalId}
          projectId={projectId}
        />
      ))}
    </div>
  );
}

/**
 * Discussion sheet for viewing and adding comments on a proposal
 */
export function DiscussionSheet({
  proposalId,
  projectId,
  proposalTitle,
  comments,
  commentCount,
}: DiscussionSheetProps) {
  const { t } = useLocale();
  const [state, formAction, isPending] = useActionState(addComment, null);
  const tree = buildCommentTree(comments);

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

        <div className="mt-4 flex h-[calc(100vh-10rem)] flex-col">
          <ScrollArea className="flex-1 pr-4">
            {tree.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("comments.noComments")}
              </p>
            ) : (
              <div className="space-y-1">
                {tree.map((comment) => (
                  <CommentNode
                    key={comment.id}
                    comment={comment}
                    depth={0}
                    proposalId={proposalId}
                    projectId={projectId}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t pt-4">
            <form action={formAction} className="space-y-2">
              <input type="hidden" name="proposalId" value={proposalId} />
              <input type="hidden" name="projectId" value={projectId} />
              <Textarea
                name="content"
                placeholder={t("comments.placeholder")}
                rows={3}
                required
                maxLength={2000}
                disabled={isPending}
              />
              {state?.error && (
                <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
              )}
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? t("comments.posting") : t("comments.submit")}
              </Button>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Format a date as locale-aware relative time (e.g., "2h ago" / "acum 2h")
 */
function formatTimeAgo(date: Date, t: TranslateFn): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return t("time.daysAgo", { count: diffDay });
  if (diffHr > 0) return t("time.hoursAgo", { count: diffHr });
  if (diffMin > 0) return t("time.minutesAgo", { count: diffMin });
  return t("time.justNow");
}
