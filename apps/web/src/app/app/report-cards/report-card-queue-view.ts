export type ReportCardQueueView = {
  service_category: string;
  status: string;
};

export function filterReportCardQueue<Card extends ReportCardQueueView>(
  cards: Card[],
  category: string,
  status: string,
) {
  return cards.filter((card) => {
    if (category !== 'all' && card.service_category !== category) return false;
    if (status === 'review') return ['review', 'correction_review'].includes(card.status);
    return status === 'all' || card.status === status;
  });
}

export function summarizeReportCardQueue(cards: ReportCardQueueView[], availableCount: number) {
  return {
    available: availableCount,
    authoring: cards.filter((card) => card.status === 'draft').length,
    review: cards.filter((card) => ['review', 'correction_review'].includes(card.status)).length,
    approved: cards.filter((card) => card.status === 'approved').length,
    published: cards.filter((card) => card.status === 'published').length,
  };
}
