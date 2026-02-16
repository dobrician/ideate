"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addComment } from "@/app/projects/[id]/proposals/comment-actions";
import { Reply, CornerDownRight, Send } from "lucide-react";
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

function ReplyForm({
  hiddenFields,
  parentId,
  formAction,
  isPending,
  error,
  onCancel,
}: {
  hiddenFields: Record<string, string>;
  parentId: string;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  error?: string;
  onCancel: () => void;
}) {
  const { t } = useLocale();
  const formRef = useRef<HTMLFormElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form ref={formRef} action={formAction} className="mt-2 space-y-2">
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="parentId" value={parentId} />
      <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
      <div className="flex items-end gap-2">
        <CornerDownRight className="mb-2 h-4 w-4 shrink-0 text-muted-foreground" />
        <Textarea
          name="content"
          placeholder={t("comments.replyPlaceholder")}
          rows={1}
          required
          maxLength={2000}
          disabled={isPending}
          onKeyDown={handleKeyDown}
          className="min-h-[38px] resize-none"
        />
        <Button type="submit" size="icon" disabled={isPending} title={t("comments.reply")}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        {t("common.cancel")}
      </Button>
    </form>
  );
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
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [state, formAction, isPending] = useActionState(addComment, null);

  useEffect(() => {
    if (state?.success) {
      toast.success(t("comments.replyPosted"));
      setReplying(false);
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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
          <ReplyForm
            hiddenFields={hiddenFields}
            parentId={comment.id}
            formAction={formAction}
            isPending={isPending}
            error={state?.error}
            onCancel={() => setReplying(false)}
          />
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
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(addComment, null);
  const formRef = useRef<HTMLFormElement>(null);
  const tree = buildCommentTree(comments);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border-b pb-4">
        <form ref={formRef} action={formAction} className="space-y-2">
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
          <div className="flex items-end gap-2">
            <Textarea
              name="content"
              placeholder={t("comments.placeholder")}
              rows={1}
              required
              maxLength={2000}
              disabled={isPending}
              onKeyDown={handleKeyDown}
              className="min-h-[38px] resize-none"
            />
            <Button type="submit" size="icon" disabled={isPending} title={t("comments.submit")}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {state?.error && (
            <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
          )}
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
