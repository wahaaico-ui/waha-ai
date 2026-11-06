/** Recent research directions around an idea, from OpenAlex topic counts (DOC-23-01). */

export type TopicCount = { id: string; name: string; count: number };
export type Direction = { id: string; name: string; recent: number; prior: number; increase: number };

export const MAX_DIRECTIONS = 20;
const MIN_RECENT = 10;

/** Topics that grew between the prior and the recent window, largest increase first. */
export function rankDirections(recent: TopicCount[], prior: TopicCount[]): Direction[] {
  const before = new Map(prior.map(topic => [topic.id, topic.count]));
  return recent
    .filter(topic => topic.count >= MIN_RECENT)
    .map(topic => {
      const previous = before.get(topic.id) ?? 0;
      return { id: topic.id, name: topic.name, recent: topic.count, prior: previous, increase: topic.count - previous };
    })
    .filter(direction => direction.increase > 0)
    .sort((a, b) => b.increase - a.increase || b.recent - a.recent || a.name.localeCompare(b.name))
    .slice(0, MAX_DIRECTIONS);
}
