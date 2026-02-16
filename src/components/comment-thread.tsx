"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addComment } from "@/app/projects/[id]/proposals/comment-actions";
import { Reply, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";

export interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  userId: string | null;
  userEmail?: string;
  userName?: string;
  createdAt: Date | null;
}

interface CommentTreeNode extends Comment {
  children: CommentTreeNode[];
}

export function buildCommentTree(comments: Comment[]): CommentTreeNode[] {
  const map = new Map<string, CommentTreeNode>();
  const roots: CommentTreeNode[] = [];

  for (const c of comments) map.set(c.id, { ...c, children: [] });
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

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function formatTimeAgo(date: Date, t: TranslateFn): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay > 0) return t("time.daysAgo", { count: diffDay });
  if (diffHr > 0) return t("time.hoursAgo", { count: diffHr });
  if (diffMin > 0) return t("time.minutesAgo", { count: diffMin });
  return t("time.justNow");
}

function CommentNode({
  comment,
  depth,
  hiddenFields,
}: {
  comment: CommentTreeNode;
  depth: number;
  hiddenFields: Record<string, string>;
}) {
  const { t } = useLocale();
  const [replying, setReplying] = useState(false);
  const [state, formAction, isPending] = useActionState(addComment, null);

  if (state?.success && replying) {
    toast.success(t("comments.replyPosted"));
    setReplying(false);
  }
  if (state?.error) toast.error(state.error);

  const displayName = comment.userName || comment.userEmail || "Anonymous";
  const timeAgo = comment.createdAt ? formatTimeAgo(comment.createdAt, t) : "";

  return (
    <div className={depth > 0 ? "ml-4 border-l-2 border-muted pl-3" : ""}>
      <div className="py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{displayName}</span>
          {timeAgo && <span>{timeAgo}</span>}
        </div>
        <p className="mt-1 text-sm whitespace-pre-wrap">{comment.content}</p>
        {depth < 3 && (
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
            {Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <input type="hidden" name="parentId" value={comment.id} />
            <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
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
              <Button type="button" variant="ghost" size="sm" onClick={() => setReplying(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        )}
      </div>
      {comment.children.map((child) => (
        <CommentNode key={child.id} comment={child} depth={depth + 1} hiddenFields={hiddenFields} />
      ))}
    </div>
  );
}

interface CommentThreadProps {
  comments: Comment[];
  hiddenFields: Record<string, string>;
}

export function CommentThread({ comments, hiddenFields }: CommentThreadProps) {
  const { t } = useLocale();
  const [state, formAction, isPending] = useActionState(addComment, null);
  const tree = buildCommentTree(comments);

  return (
    <div className="flex flex-col gap-4">
      <div className="border-b pb-4">
        <form action={formAction} className="space-y-2">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
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
          <Button type="submit" disabled={isPending}>
            {isPending ? t("comments.posting") : t("comments.submit")}
          </Button>
        </form>
      </div>
      <ScrollArea className="max-h-[60vh] pr-4">
        {tree.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("comments.noComments")}
          </p>
        ) : (
          <div className="space-y-1">
            {tree.map((c) => (
              <CommentNode key={c.id} comment={c} depth={0} hiddenFields={hiddenFields} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
