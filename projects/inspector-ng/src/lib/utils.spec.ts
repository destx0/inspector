import { formatRelativeTime } from './utils';

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-07-14T12:00:00.000Z');

  it('uses compact command-palette units', () => {
    expect(formatRelativeTime('2026-07-14T11:59:50.000Z', now)).toBe('now');
    expect(formatRelativeTime('2026-07-14T11:58:00.000Z', now)).toBe('2m');
    expect(formatRelativeTime('2026-07-14T10:00:00.000Z', now)).toBe('2h');
    expect(formatRelativeTime('2026-07-12T12:00:00.000Z', now)).toBe('2d');
  });
});
