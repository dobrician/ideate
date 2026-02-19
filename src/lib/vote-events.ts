/**
 * Vote event emitter with pub/sub support.
 * Uses Redis pub/sub when available for cross-instance delivery,
 * falls back to in-memory for single-instance setups.
 *
 * Flow:
 *  1. emitVoteChange() publishes to pub/sub channel
 *  2. pub/sub delivers to all subscribers (local or cross-instance)
 *  3. Subscriber handler calls deliverLocally() to notify SSE listeners
 */

import { getPubSub } from "@/lib/pubsub";

type VoteListener = (data: VoteEvent) => void;

export interface VoteEvent {
  proposalId: string;
  projectId: string;
  upvotes: number;
  downvotes: number;
}

const CHANNEL_PREFIX = "votes:";

const listeners = new Map<string, Set<VoteListener>>();

/**
 * Deliver an event to all local listeners for a project.
 */
function deliverLocally(event: VoteEvent): void {
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

/**
 * Subscribe to vote changes for a project.
 * Subscribes via pub/sub for delivery (both local and cross-instance).
 */
export function subscribeVotes(
  projectId: string,
  listener: VoteListener,
): () => void {
  let set = listeners.get(projectId);
  const isFirstListener = !set;
  if (!set) {
    set = new Set();
    listeners.set(projectId, set);
  }
  set.add(listener);

  // Subscribe to pub/sub channel when first listener registers
  let unsubPubSub: (() => void) | null = null;
  if (isFirstListener) {
    const pubsub = getPubSub();
    unsubPubSub = pubsub.subscribe(
      `${CHANNEL_PREFIX}${projectId}`,
      (_channel, message) => {
        try {
          const event = JSON.parse(message) as VoteEvent;
          deliverLocally(event);
        } catch {
          // ignore malformed messages
        }
      },
    );
  }

  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      listeners.delete(projectId);
      unsubPubSub?.();
    }
  };
}

/**
 * Emit a vote change to all listeners across all instances.
 * Publishes to pub/sub which delivers to all subscribers
 * (including the local subscriber handler which calls deliverLocally).
 */
export function emitVoteChange(event: VoteEvent): void {
  const pubsub = getPubSub();
  pubsub.publish(
    `${CHANNEL_PREFIX}${event.projectId}`,
    JSON.stringify(event),
  );
}
