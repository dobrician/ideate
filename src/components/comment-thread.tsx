"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { addComment } from "@/app/projects/[id]/proposals/comment-actions";
import { Send } from "lucide-react";
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

export function buildCommentTree(comments: Comment[]): Comment[] {
  return [...comments].sort(
    (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
  );
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

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ChatBubble({
  comment,
  isOwn,
}: {
  comment: Comment;
  isOwn: boolean;
}) {
  const { t } = useLocale();
  const displayName = comment.userName || comment.userEmail || "Anonymous";
  const timeAgo = comment.createdAt ? formatTimeAgo(comment.createdAt, t) : "";
  const initials = getInitials(displayName);

  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      <Avatar size="sm" className="mt-1 shrink-0">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-0.5">
          {!isOwn && (
            <span className="text-xs font-medium text-foreground">{displayName}</span>
          )}
          {timeAgo && <span className="text-xs text-muted-foreground">{timeAgo}</span>}
        </div>
        <div
          className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
            isOwn
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          {comment.content}
        </div>
      </div>
    </div>
  );
}

interface CommentThreadProps {
  comments: Comment[];
  hiddenFields: Record<string, string>;
  currentUserId?: string;
}

export function CommentThread({ comments, hiddenFields, currentUserId }: CommentThreadProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(addComment, null);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sorted = buildCommentTree(comments);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-slot='scroll-area-viewport']");
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea ref={scrollRef} className="flex-1 pr-2">
        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("comments.noComments")}
          </p>
        ) : (
          <div className="space-y-3 pb-2">
            {sorted.map((c) => (
              <ChatBubble
                key={c.id}
                comment={c}
                isOwn={!!currentUserId && c.userId === currentUserId}
              />
            ))}
          </div>
        )}
      </ScrollArea>
      <div className="border-t pt-3">
        <form ref={formRef} action={formAction}>
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
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
