export const LISTING_MODERATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'FLAGGED',
] as const;

export type ListingModerationStatus =
  (typeof LISTING_MODERATION_STATUSES)[number];

export const LISTING_MODERATION_DECISIONS = [
  'APPROVE',
  'REJECT',
  'SUSPEND',
  'FLAG',
  'CLEAR_FLAG',
  'NOTE',
] as const;

export type ListingModerationDecisionCode =
  (typeof LISTING_MODERATION_DECISIONS)[number];

/** Statuses that need moderator attention in the primary queue. */
export const ACTIONABLE_MODERATION_STATUSES: ListingModerationStatus[] = [
  'PENDING',
  'FLAGGED',
];

export function statusAfterModerationDecision(
  decision: ListingModerationDecisionCode,
  current: ListingModerationStatus,
): ListingModerationStatus {
  switch (decision) {
    case 'APPROVE':
    case 'CLEAR_FLAG':
      return 'APPROVED';
    case 'REJECT':
      return 'REJECTED';
    case 'SUSPEND':
      return 'SUSPENDED';
    case 'FLAG':
      return 'FLAGGED';
    case 'NOTE':
      return current;
    default:
      return current;
  }
}

export function requiresModerationReason(
  decision: ListingModerationDecisionCode,
): boolean {
  return (
    decision === 'REJECT' ||
    decision === 'SUSPEND' ||
    decision === 'FLAG'
  );
}

export function isPubliclyVisibleModeration(
  moderationStatus: string,
): boolean {
  return moderationStatus === 'APPROVED';
}
