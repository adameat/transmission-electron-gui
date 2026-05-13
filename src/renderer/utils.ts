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

export function torrentListSize(torrent: Torrent): number {
  const selectedSize = Number.isFinite(torrent.sizeWhenDone) ? torrent.sizeWhenDone : 0;
  const totalSize = Number.isFinite(torrent.totalSize) ? torrent.totalSize : 0;
  return selectedSize > 0 ? selectedSize : totalSize;
}

export function torrentTotalSize(torrent: Torrent): number {
  const totalSize = Number.isFinite(torrent.totalSize) ? torrent.totalSize : 0;
  const selectedSize = Number.isFinite(torrent.sizeWhenDone) ? torrent.sizeWhenDone : 0;
  return totalSize > 0 ? totalSize : selectedSize;
}

const byteUnits = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

function clampByteUnitIndex(unitIndex: number): number {
  if (!Number.isFinite(unitIndex)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.trunc(unitIndex), byteUnits.length - 1));
}

export function byteUnitIndexForValue(value = 0): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return clampByteUnitIndex(Math.floor(Math.log(value) / Math.log(1024)));
}

export function formatBytes(value = 0, fractionDigits = 1, unitIndex?: number): string {
  const normalizedValue = Number.isFinite(value) && value > 0 ? value : 0;
  const resolvedUnitIndex = unitIndex === undefined ? byteUnitIndexForValue(normalizedValue) : clampByteUnitIndex(unitIndex);
  const scaledValue = normalizedValue / 1024 ** resolvedUnitIndex;
  return `${scaledValue.toFixed(resolvedUnitIndex === 0 ? 0 : fractionDigits)} ${byteUnits[resolvedUnitIndex]}`;
}

export function formatRate(value = 0, unitIndex?: number): string {
  return `${formatBytes(value, 1, unitIndex)}/s`;
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
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'Never';
  }

  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
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
