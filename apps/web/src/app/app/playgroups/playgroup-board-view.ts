export type PlaygroupSessionView = {
  active_count: number;
  effective_capacity: number;
  removed_count: number;
  resting_count: number;
  size_band: string;
};

export function filterPlaygroupSessions<Session extends PlaygroupSessionView>(
  sessions: Session[],
  sizeBand: string,
  view: string,
) {
  return sessions.filter((session) => {
    if (sizeBand !== 'all' && session.size_band !== sizeBand) return false;
    if (view === 'available') return session.active_count < session.effective_capacity;
    if (view === 'full') return session.active_count >= session.effective_capacity;
    if (view === 'attention') return session.removed_count > 0;
    return true;
  });
}

export function summarizePlaygroupBoard(sessions: PlaygroupSessionView[], eligibleCount: number) {
  return {
    sessions: sessions.length,
    active: sessions.reduce((total, session) => total + session.active_count, 0),
    resting: sessions.reduce((total, session) => total + session.resting_count, 0),
    removed: sessions.reduce((total, session) => total + session.removed_count, 0),
    eligible: eligibleCount,
  };
}
