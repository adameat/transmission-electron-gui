import type { SessionStats, Torrent, TransmissionProfile } from '@shared/types';
import { compactHost, formatBytes, summarizeStats } from '../utils';

interface StatusBarProps {
  connected: boolean;
  profile: TransmissionProfile;
  stats: SessionStats | null;
  selectedTorrent: Torrent | null;
  message: string;
}

export function StatusBar({ connected, profile, stats, selectedTorrent, message }: StatusBarProps): JSX.Element {
  return (
    <footer className="status-bar">
      <span className={connected ? 'connection-dot connected' : 'connection-dot'} />
      <span>{connected ? compactHost(profile.protocol, profile.host, profile.port) : 'Disconnected'}</span>
      <span>{stats ? `${stats.torrentCount} torrents` : '0 torrents'}</span>
      <span>{summarizeStats(stats)}</span>
      <span>
        {selectedTorrent
          ? `${selectedTorrent.name} · ${formatBytes(selectedTorrent.downloadedEver)} down · ${formatBytes(selectedTorrent.uploadedEver)} up`
          : 'No selection'}
      </span>
      <strong>{message}</strong>
    </footer>
  );
}
