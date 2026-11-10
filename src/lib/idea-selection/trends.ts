/** Recent research directions around an idea, from OpenAlex topic counts (DOC-23-01). */

export type TopicCount = { id: string; name: string; count: number };
export type Direction = { id: string; name: string; recent: number; prior: number; increase: number };

export const MAX_DIRECTIONS = 20;
const MIN_RECENT = 10;

/**
 * Topics that grew faster than all research between the prior and the recent
 * window, largest increase first. `baseRatio` is how much everything OpenAlex
 * indexes grew over the same windows; `increase` is beyond that expected growth.
 */
export function rankDirections(recent: TopicCount[], prior: TopicCount[], baseRatio = 1): Direction[] {
  const before = new Map(prior.map(topic => [topic.id, topic.count]));
  return recent
    .filter(topic => topic.count >= MIN_RECENT)
    .map(topic => {
      const previous = before.get(topic.id) ?? 0;
      return { id: topic.id, name: topic.name, recent: topic.count, prior: previous, increase: Math.round(topic.count - previous * baseRatio) };
    })
    .filter(direction => direction.increase > 0)
    .sort((a, b) => b.increase - a.increase || b.recent - a.recent || a.name.localeCompare(b.name))
    .slice(0, MAX_DIRECTIONS);
}
