"use client";

import { useActionState, useCallback, useEffect, useOptimistic, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { addComment } from "@/app/projects/[id]/proposals/comment-actions";
import { Send, ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { MarkdownRenderer } from "@/components/markdown-renderer";

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

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-600", "bg-emerald-600", "bg-violet-600",
  "bg-amber-600", "bg-rose-600", "bg-cyan-600",
  "bg-pink-600", "bg-indigo-600",
];

export function avatarColor(userId: string | null): string {
  if (!userId) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function ChatBubble({
  comment,
  isOwn,
  showAvatar,
}: {
  comment: Comment;
  isOwn: boolean;
  showAvatar: boolean;
}) {
  const { t } = useLocale();
  const displayName = comment.userName || comment.userEmail || "Anonymous";
  const timeAgo = comment.createdAt ? formatTimeAgo(comment.createdAt, t) : "";
  const initials = getInitials(displayName);
  const colorClass = avatarColor(comment.userId);

  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
      {showAvatar ? (
        <Avatar size="sm" className="mt-1 shrink-0">
          <AvatarFallback className={`${colorClass} text-white`}>{initials}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-6 shrink-0" />
      )}
      <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
        {showAvatar && (
          <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? "flex-row-reverse" : ""}`}>
            <span className="text-xs font-medium text-foreground">
              {isOwn ? t("comments.you") : displayName}
            </span>
            {timeAgo && <span className="text-xs text-muted-foreground">{timeAgo}</span>}
          </div>
        )}
        <div
          className={`rounded-2xl px-3 py-2 text-sm ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          }`}
        >
          <MarkdownRenderer content={comment.content} simple />
        </div>
        {!showAvatar && timeAgo && (
          <span className={`text-[10px] text-muted-foreground mt-0.5 block ${isOwn ? "text-right" : ""}`}>
            {timeAgo}
          </span>
        )}
      </div>
    </div>
  );
}

interface CommentThreadProps {
  comments: Comment[];
  hiddenFields: Record<string, string>;
  currentUserId?: string;
}

function isNearBottom(el: Element, threshold = 100): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

export function CommentThread({ comments, hiddenFields, currentUserId }: CommentThreadProps) {
  const { t } = useLocale();
  const router = useRouter();
  const [state, baseFormAction, isPending] = useActionState(addComment, null);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevCountRef = useRef(comments.length);
  const [showNewIndicator, setShowNewIndicator] = useState(false);
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    comments,
    (current: Comment[], newComment: Comment) => [...current, newComment]
  );
  const sorted = buildCommentTree(optimisticComments);

  async function formAction(formData: FormData) {
    const content = formData.get("content") as string;
    if (content && currentUserId) {
      addOptimisticComment({
        id: `optimistic-${optimisticComments.length}`,
        content,
        parentId: null,
        userId: currentUserId,
        createdAt: null,
      });
    }
    return baseFormAction(formData);
  }

  const getViewport = useCallback(() => {
    return scrollRef.current?.querySelector("[data-slot='scroll-area-viewport']") as Element | null;
  }, []);

  function scrollToBottom() {
    const el = getViewport();
    if (el) {
      el.scrollTop = el.scrollHeight;
      setShowNewIndicator(false);
    }
  }

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      if (textareaRef.current) textareaRef.current.style.height = "";
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    const el = getViewport();
    if (!el) return;
    const isNew = comments.length > prevCountRef.current;
    prevCountRef.current = comments.length;
    if (!isNew || isNearBottom(el)) {
      el.scrollTop = el.scrollHeight;
    } else {
      requestAnimationFrame(() => setShowNewIndicator(true));
    }
  }, [comments.length, getViewport]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    ta.style.height = "";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1">
        <ScrollArea ref={scrollRef} className="h-full pr-2">
          {sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("comments.noComments")}
            </p>
          ) : (
            <div className="space-y-1 pb-2">
              {sorted.map((c, i) => {
                const prev = i > 0 ? sorted[i - 1] : null;
                const showAvatar = !prev || prev.userId !== c.userId;
                return (
                  <div key={c.id} className={showAvatar && i > 0 ? "pt-2" : ""}>
                    <ChatBubble
                      comment={c}
                      isOwn={!!currentUserId && c.userId === currentUserId}
                      showAvatar={showAvatar}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        {showNewIndicator && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-md"
          >
            <ChevronDown className="h-3 w-3" />
            {t("comments.newMessages")}
          </button>
        )}
      </div>
      <div className="border-t pt-3">
        <form ref={formRef} action={formAction}>
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              name="content"
              placeholder={t("comments.placeholder")}
              rows={1}
              required
              maxLength={2000}
              disabled={isPending}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              className="min-h-[44px] max-h-[120px] resize-none"
            />
            <Button
              type="submit"
              size="icon"
              disabled={isPending}
              title={t("comments.submit")}
              className="h-[44px] w-[44px] shrink-0"
            >
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
