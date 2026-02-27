/**
 * Configurable TTL tiers for different data types.
 * Provides consistent cache durations across the application.
 */

/** TTL values in seconds for each data tier. */
export const TTL_TIERS = {
  /** Rarely changing data: roles, permissions, system config. 1 hour. */
  static: 3600,
  /** Slowly changing: project metadata, user profiles. 10 minutes. */
  slow: 600,
  /** Moderately changing: proposal lists, dashboard data. 5 minutes. */
  moderate: 300,
  /** Frequently changing: vote counts, comment lists. 1 minute. */
  fast: 60,
  /** Real-time-ish: active sessions, typing indicators. 15 seconds. */
  realtime: 15,
} as const;

export type TTLTier = keyof typeof TTL_TIERS;

/** Map of entity types to their default TTL tier. */
const ENTITY_TTL_MAP: Record<string, TTLTier> = {
  "project": "slow",
  "project:list": "moderate",
  "proposal": "moderate",
  "proposal:list": "moderate",
  "vote": "fast",
  "vote:count": "fast",
  "comment": "fast",
  "comment:list": "fast",
  "dashboard": "moderate",
  "user:profile": "slow",
  "search:results": "fast",
  "search:suggestions": "moderate",
  "analytics": "slow",
  "permission": "static",
  "workflow": "slow",
  "ai:insight": "slow",
};

/**
 * Get TTL in seconds for a given entity type.
 * Falls back to 'moderate' tier (300s) for unknown types.
 */
export function getTTLForEntity(entityType: string): number {
  const tier = ENTITY_TTL_MAP[entityType] ?? "moderate";
  return TTL_TIERS[tier];
}

/**
 * Get TTL in seconds for a given tier name.
 */
export function getTTL(tier: TTLTier): number {
  return TTL_TIERS[tier];
}
