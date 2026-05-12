import type { SessionStats, Torrent, TorrentFilter } from '@shared/types';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const FILTER_LABELS: Record<TorrentFilter, string> = {
  all: 'All',
  downloading: 'Downloading',
  completed: 'Completed',
  active: 'Active',
  inactive: 'Inactive',
  stopped: 'Stopped',
  error: 'Error',
  waiting: 'Waiting'
};

export function formatBytes(value = 0, fractionDigits = 1): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const scaledValue = value / 1024 ** unitIndex;
  return `${scaledValue.toFixed(unitIndex === 0 ? 0 : fractionDigits)} ${units[unitIndex]}`;
}

export function formatRate(value = 0): string {
  return `${formatBytes(value)}/s`;
}

export function formatPercent(value = 0): string {
  return `${Math.max(0, Math.min(100, value * 100)).toFixed(1)}%`;
}

export function formatRatio(value = 0): string {
  if (!Number.isFinite(value) || value < 0) {
    return '0.00';
  }

  if (value > 999) {
    return '999+';
  }

  return value.toFixed(2);
}

export function formatDuration(seconds = 0): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '∞';
  }

  if (seconds === 0) {
    return '0m';
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

export function formatDate(timestamp = 0): string {
  if (!timestamp) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp * 1000));
}

export function statusText(torrent: Torrent): string {
  if (torrent.error) {
    return 'Error';
  }

  switch (torrent.status) {
    case 0:
      return torrent.percentDone >= 1 ? 'Finished' : 'Stopped';
    case 1:
      return 'Queued check';
    case 2:
      return 'Verifying';
    case 3:
      return 'Queued';
    case 4:
      return 'Downloading';
    case 5:
      return 'Queued seed';
    case 6:
      return 'Seeding';
    default:
      return 'Unknown';
  }
}

export function torrentMatchesFilter(torrent: Torrent, filter: TorrentFilter): boolean {
  const active = (torrent.rateDownload || 0) > 0 || (torrent.rateUpload || 0) > 0;
  const completed = torrent.percentDone >= 1;
  const waiting = torrent.status === 1 || torrent.status === 3 || torrent.status === 5;

  switch (filter) {
    case 'downloading':
      return torrent.status === 4;
    case 'completed':
      return completed;
    case 'active':
      return active;
    case 'inactive':
      return !active && torrent.status !== 0;
    case 'stopped':
      return torrent.status === 0;
    case 'error':
      return Boolean(torrent.error);
    case 'waiting':
      return waiting;
    case 'all':
    default:
      return true;
  }
}

export function countFilters(torrents: Torrent[]): Record<TorrentFilter, number> {
  return Object.keys(FILTER_LABELS).reduce(
    (counts, filterKey) => {
      const filter = filterKey as TorrentFilter;
      counts[filter] = torrents.filter((torrent) => torrentMatchesFilter(torrent, filter)).length;
      return counts;
    },
    {} as Record<TorrentFilter, number>
  );
}

export function compactHost(protocol: string, host: string, port: number): string {
  return `${protocol}://${host}:${port}`;
}

export function summarizeStats(stats: SessionStats | null): string {
  if (!stats) {
    return 'D: 0 B/s  U: 0 B/s';
  }

  return `D: ${formatRate(stats.downloadSpeed)}  U: ${formatRate(stats.uploadSpeed)}`;
}

export function priorityLabel(priority: number): string {
  if (priority > 0) {
    return 'High';
  }

  if (priority < 0) {
    return 'Low';
  }

  return 'Normal';
}
