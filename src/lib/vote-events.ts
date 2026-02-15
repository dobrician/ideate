/**
 * In-process event emitter for real-time vote updates via SSE.
 * Manages per-project subscriber sets.
 */

type VoteListener = (data: VoteEvent) => void;

export interface VoteEvent {
  proposalId: string;
  projectId: string;
  upvotes: number;
  downvotes: number;
}

const listeners = new Map<string, Set<VoteListener>>();

/**
 * Subscribe to vote changes for a project
 */
export function subscribeVotes(
  projectId: string,
  listener: VoteListener
): () => void {
  let set = listeners.get(projectId);
  if (!set) {
    set = new Set();
    listeners.set(projectId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(projectId);
  };
}

/**
 * Emit a vote change to all listeners for a project
 */
export function emitVoteChange(event: VoteEvent): void {
  const set = listeners.get(event.projectId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      // listener errors shouldn't break the emitter
    }
  }
}
