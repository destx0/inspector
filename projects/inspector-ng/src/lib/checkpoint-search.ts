import {
  InspectorCheckpointRecord,
  recentActivityFirst,
} from './checkpoints';

interface RankedCheckpoint {
  checkpoint: InspectorCheckpointRecord;
  score: number;
}

export function fuzzyCheckpoints(
  checkpoints: InspectorCheckpointRecord[],
  query: string,
): InspectorCheckpointRecord[] {
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) return [...checkpoints].sort(recentActivityFirst);

  return checkpoints
    .map((checkpoint): RankedCheckpoint | null => {
      const score = fuzzyScore(checkpoint.name, normalizedQuery);
      return score === null ? null : { checkpoint, score };
    })
    .filter((item): item is RankedCheckpoint => item !== null)
    .sort((a, b) => b.score - a.score || recentActivityFirst(a.checkpoint, b.checkpoint))
    .map(({ checkpoint }) => checkpoint);
}

export function fuzzyScore(value: string, normalizedQuery: string): number | null {
  const candidate = normalize(value);
  if (candidate === normalizedQuery) return 10_000;
  if (candidate.startsWith(normalizedQuery)) return 8_000 - candidate.length;

  const substringIndex = candidate.indexOf(normalizedQuery);
  if (substringIndex >= 0) return 6_000 - substringIndex * 10 - candidate.length;

  let queryIndex = 0;
  let firstIndex = -1;
  let lastIndex = -1;
  let gapPenalty = 0;
  for (let index = 0; index < candidate.length && queryIndex < normalizedQuery.length; index += 1) {
    if (candidate[index] !== normalizedQuery[queryIndex]) continue;
    if (firstIndex < 0) firstIndex = index;
    if (lastIndex >= 0) gapPenalty += index - lastIndex - 1;
    lastIndex = index;
    queryIndex += 1;
  }
  if (queryIndex !== normalizedQuery.length) return null;
  return 4_000 - firstIndex * 10 - gapPenalty * 20 - candidate.length;
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}
