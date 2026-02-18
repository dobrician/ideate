"use client";

import { useActionState, useCallback, useEffect, useOptimistic, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { addComment } from "@/app/projects/[id]/proposals/comment-actions";
import { Send, ChevronDown, MessageSquare, Reply } from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { getCsrfTokenClient } from "@/lib/csrf-client";
import { buildThreadedCommentTree, isNearBottom } from "@/lib/comment-utils";
import { ThreadedCommentNode } from "@/components/chat-bubble";
import type { Comment } from "@/lib/comment-utils";

interface CommentThreadProps {
  comments: Comment[];
  hiddenFields: Record<string, string>;
  currentUserId?: string;
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
  const [charCount, setCharCount] = useState(0);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    comments,
    (current: Comment[], newComment: Comment) => [...current, newComment]
  );
  const tree = buildThreadedCommentTree(optimisticComments);

  const replyToComment = replyToId
    ? optimisticComments.find((c) => c.id === replyToId)
    : null;

  async function formAction(formData: FormData) {
    const content = formData.get("content") as string;
    if (content && currentUserId) {
      addOptimisticComment({
        id: `optimistic-${optimisticComments.length}`,
        content,
        parentId: replyToId,
        userId: currentUserId,
        createdAt: null,
      });
    }
    setCharCount(0);
    setReplyToId(null);
    return baseFormAction(formData);
  }

  function handleReply(parentId: string) {
    setReplyToId(parentId);
    textareaRef.current?.focus();
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

  useKeyboardInset();

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
    if (e.key === "Escape" && replyToId) {
      setReplyToId(null);
    }
  }

  function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    ta.style.height = "";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    setCharCount(ta.value.length);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1">
        <ScrollArea ref={scrollRef} className="h-full pr-2">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-6">
              <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-center text-sm text-muted-foreground">
                {t("comments.noComments")}
              </p>
            </div>
          ) : (
            <div className="space-y-1 pb-2">
              {tree.map((node, i) => (
                <div key={node.id} className={i > 0 ? "pt-2" : ""}>
                  <ThreadedCommentNode
                    node={node}
                    depth={0}
                    currentUserId={currentUserId}
                    onReply={handleReply}
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
          {showNewIndicator ? t("comments.newCommentsAria") : ""}
        </div>
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
      <div className="border-t pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:pt-3">
        {replyToComment && (
          <div className="flex items-center gap-2 mb-1.5 px-1 text-xs text-muted-foreground">
            <Reply className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {t("comments.replyingTo", {
                name: replyToComment.userName || replyToComment.userEmail || t("common.anonymous"),
              })}
            </span>
            <button
              type="button"
              onClick={() => setReplyToId(null)}
              className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
              aria-label={t("common.cancel")}
            >
              &times;
            </button>
          </div>
        )}
        <form ref={formRef} action={formAction} noValidate>
          {Object.entries(hiddenFields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <input type="hidden" name="csrfToken" value={getCsrfTokenClient()} />
          {replyToId && (
            <input type="hidden" name="parentId" value={replyToId} />
          )}
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              name="content"
              placeholder={replyToId ? t("comments.replyPlaceholder") : t("comments.placeholder")}
              rows={1}
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
              aria-label={t("comments.submit")}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {charCount >= 1800 && (
            <p
              data-testid="char-count"
              className={`mt-1 text-right text-xs ${
                charCount >= 2000 ? "text-destructive font-medium" : "text-muted-foreground"
              }`}
            >
              {charCount}/2000
            </p>
          )}
          {state?.error && (
            <p className="mt-1 text-xs text-red-700 dark:text-red-400" role="alert">{state.error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
