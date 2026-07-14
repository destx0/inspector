export const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export const formatValue = (value: number) => Math.round(value);

/** Ultra-compact relative time for dense command-palette metadata. */
export const formatRelativeTime = (iso: string, now = Date.now()): string => {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }

  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) {
    return 'now';
  }
  if (seconds < 90) {
    return '1m';
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.round(hours / 24);
  if (days < 30) {
    return `${days}d`;
  }

  const months = Math.round(days / 30);
  if (months < 12) {
    return `${months}mo`;
  }

  return `${Math.round(months / 12)}y`;
};
