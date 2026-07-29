export type AvailabilityReasonView = {
  code?: string;
  key?: string;
  level?: string;
  message: string;
};

export type AvailabilityResultView = {
  available: boolean;
  reasons: AvailabilityReasonView[];
  remaining_capacity: number;
  requires_review: boolean;
};

export type AvailabilityDecision = 'available' | 'review' | 'blocked';

export function getAvailabilityDecision(result: AvailabilityResultView): AvailabilityDecision {
  if (!result.available) return 'blocked';
  if (result.requires_review) return 'review';
  return 'available';
}

export function isReviewReason(reason: AvailabilityReasonView) {
  return Boolean(reason.level && reason.level !== 'block');
}

export function summarizeAvailabilityResult(result: AvailabilityResultView) {
  return {
    decision: getAvailabilityDecision(result),
    remainingCapacity: result.remaining_capacity,
    blockingReasons: result.reasons.filter((reason) => !isReviewReason(reason)).length,
    reviewReasons: result.reasons.filter(isReviewReason).length,
  };
}

export function formatAvailabilityReason(reason: AvailabilityReasonView) {
  return (reason.code ?? reason.key ?? 'review').replaceAll('_', ' ');
}
