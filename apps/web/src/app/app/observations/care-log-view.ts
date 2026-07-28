export type CareObservationView = {
  category: string;
  concern_level: string;
  customer_visible: boolean;
};

export type ConcernView = 'all' | 'attention' | 'urgent' | 'information';

export function filterCareObservations<Observation extends CareObservationView>(
  observations: Observation[],
  category: string,
  concern: ConcernView,
) {
  return observations.filter((observation) => {
    if (category !== 'all' && observation.category !== category) return false;
    if (concern === 'attention') return observation.concern_level !== 'information';
    if (concern === 'urgent') {
      return ['urgent', 'critical'].includes(observation.concern_level);
    }
    return concern === 'all' || observation.concern_level === 'information';
  });
}

export function summarizeCareObservations(observations: CareObservationView[]) {
  return {
    recorded: observations.length,
    attention: observations.filter((observation) => observation.concern_level !== 'information')
      .length,
    urgent: observations.filter((observation) =>
      ['urgent', 'critical'].includes(observation.concern_level),
    ).length,
    customerVisible: observations.filter((observation) => observation.customer_visible).length,
  };
}
