import { InspectorCheckpointRecord } from './checkpoints';
import { fuzzyCheckpoints, fuzzyScore } from './checkpoint-search';

function checkpoint(id: string, name: string, createdAt: string): InspectorCheckpointRecord {
  return { version: 1, id, name, route: '/', createdAt, state: {} };
}

describe('checkpoint fuzzy search', () => {
  const records = [
    checkpoint('exact', 'Summary', '2026-01-01T00:00:00.000Z'),
    checkpoint('prefix', 'Summary ready', '2026-01-04T00:00:00.000Z'),
    checkpoint('substring', 'Reviewed summary', '2026-01-03T00:00:00.000Z'),
    checkpoint('subsequence', 'Save monthly report', '2026-01-02T00:00:00.000Z'),
  ];

  it('ranks exact, prefix, substring, then subsequence matches', () => {
    expect(fuzzyCheckpoints(records, 'summary').map(({ id }) => id)).toEqual([
      'exact', 'prefix', 'substring',
    ]);
    expect(fuzzyCheckpoints(records, 'smr').map(({ id }) => id)).toContain('subsequence');
  });

  it('normalizes case and diacritics', () => {
    expect(fuzzyScore('Résumé ready', 'resume')).not.toBeNull();
  });

  it('uses newest-first ordering for an empty query and equal scores', () => {
    expect(fuzzyCheckpoints(records, '').map(({ id }) => id)).toEqual([
      'prefix', 'substring', 'subsequence', 'exact',
    ]);
  });

  it('returns no result when the ordered subsequence is absent', () => {
    expect(fuzzyCheckpoints(records, 'xyz')).toEqual([]);
  });

  it('searches 500 checkpoints without dropping matches', () => {
    const many = Array.from({ length: 500 }, (_, index) =>
      checkpoint(String(index), `Checkpoint ${index}`, new Date(index).toISOString()),
    );
    expect(fuzzyCheckpoints(many, 'Checkpoint 499')[0].id).toBe('499');
  });
});
