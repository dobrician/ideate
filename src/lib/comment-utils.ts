export interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  userId: string | null;
  userEmail?: string;
  userName?: string;
  avatarUrl?: string;
  createdAt: Date | null;
}

export interface CommentNode extends Comment {
  children: CommentNode[];
}

export const MAX_THREAD_DEPTH = 3;

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function buildThreadedCommentTree(comments: Comment[]): CommentNode[] {
  const sorted = [...comments].sort(
    (a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)
  );

  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const c of sorted) {
    map.set(c.id, { ...c, children: [] });
  }

  for (const c of sorted) {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

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

const AVATAR_COLORS = ["bg-blue-600", "bg-emerald-600", "bg-violet-600", "bg-amber-600", "bg-rose-600", "bg-cyan-600", "bg-pink-600", "bg-indigo-600"];

export function avatarColor(userId: string | null): string {
  if (!userId) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function isNearBottom(el: Element, threshold = 100): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}
