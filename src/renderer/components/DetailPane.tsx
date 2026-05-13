import { useEffect } from 'react';
import type { SessionStats, Torrent, TorrentFile, TorrentFileStat, TransmissionProfile, TransmissionSession } from '@shared/types';
import { formatBytes, formatDate, formatDuration, formatPercent, formatRate, formatRatio, priorityLabel, statusText, torrentTotalSize } from '../utils';

export type DetailTab = 'general' | 'files' | 'peers' | 'trackers' | 'stats' | 'direct';

interface DetailPaneProps {
  torrent: Torrent | null;
  profile: TransmissionProfile;
  session: TransmissionSession | null;
  stats: SessionStats | null;
  activeTab: DetailTab;
  busy: boolean;
  onTabChange: (tab: DetailTab) => void;
  onFileWantedChange: (fileIndex: number, wanted: boolean) => void;
  onFilePriorityChange: (fileIndex: number, priority: -1 | 0 | 1) => void;
}

const baseTabs: Array<{ id: DetailTab; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'files', label: 'Files' },
  { id: 'peers', label: 'Peers' },
  { id: 'trackers', label: 'Trackers' },
  { id: 'stats', label: 'Stats' }
];

interface DirectDownloadLink {
  label: string;
  size: number;
  url: string;
}

interface DirectDownloadState {
  folderPath: string;
  folderUrl: string | null;
  links: DirectDownloadLink[];
  message?: string;
}

function InfoGrid({ items }: { items: Array<[string, string]> }): JSX.Element {
  return (
    <dl className="info-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function fileProgress(file: TorrentFile, stat?: TorrentFileStat): string {
  const completed = stat?.bytesCompleted ?? file.bytesCompleted ?? 0;
  return file.length > 0 ? formatPercent(completed / file.length) : '0.0%';
}

function normalizeServerPath(value: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  return normalized === '/' ? normalized : normalized.replace(/\/+$/g, '');
}

function pathSegments(value: string): string[] {
  return value.replace(/\\/g, '/').split('/').filter(Boolean);
}

function hasUnsafePathSegment(value: string): boolean {
  return pathSegments(value).some((segment) => segment === '.' || segment === '..');
}

function relativeDownloadPath(downloadDir: string, localRoot: string): string | null {
  const normalizedDownloadDir = normalizeServerPath(downloadDir);
  const normalizedLocalRoot = normalizeServerPath(localRoot);

  if (!normalizedDownloadDir || !normalizedLocalRoot || hasUnsafePathSegment(normalizedDownloadDir) || hasUnsafePathSegment(normalizedLocalRoot)) {
    return null;
  }

  if (normalizedLocalRoot === '/') {
    return normalizedDownloadDir.replace(/^\/+/, '');
  }

  if (normalizedDownloadDir === normalizedLocalRoot) {
    return '';
  }

  const rootPrefix = `${normalizedLocalRoot}/`;
  return normalizedDownloadDir.startsWith(rootPrefix) ? normalizedDownloadDir.slice(rootPrefix.length) : null;
}

function safeEncodedPath(...paths: string[]): string | null {
  const segments = paths.flatMap(pathSegments);
  // The URL API normalizes literal . and .. segments when assigning pathname, so reject them before building external links.
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  return segments.map(encodeURIComponent).join('/');
}

function directDownloadUrl(rootUrl: string, ...paths: string[]): string | null {
  try {
    const url = new URL(rootUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    const rootPath = url.pathname.replace(/\/+$/g, '');
    const suffix = safeEncodedPath(...paths);
    if (suffix === null) {
      return null;
    }

    url.pathname = suffix ? `${rootPath}/${suffix}` : `${rootPath}/`;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function buildDirectDownloadState(torrent: Torrent, profile: TransmissionProfile): DirectDownloadState | null {
  const rootUrl = profile.directDownloadUrl.trim();
  const localRoot = profile.directDownloadLocalPath.trim();

  if (!rootUrl || !localRoot || torrent.percentDone < 1) {
    return null;
  }

  const relativePath = relativeDownloadPath(torrent.downloadDir, localRoot);
  if (relativePath === null) {
    return {
      folderPath: torrent.downloadDir || 'Unknown',
      folderUrl: null,
      links: [],
      message: 'Download folder is outside the configured local path root.'
    };
  }

  const folderUrl = directDownloadUrl(rootUrl, relativePath);
  if (!folderUrl) {
    return {
      folderPath: relativePath || '/',
      folderUrl: null,
      links: [],
      message: 'Direct download URL must be HTTP or HTTPS.'
    };
  }

  const fileStats = torrent.fileStats ?? [];
  const links = (torrent.files ?? []).flatMap((file, fileIndex) => {
    if (fileStats[fileIndex]?.wanted === false) {
      return [];
    }

    const url = directDownloadUrl(rootUrl, relativePath, file.name);
    return url ? [{ label: file.name, size: file.length, url }] : [];
  });

  return {
    folderPath: relativePath || '/',
    folderUrl,
    links
  };
}

export function DetailPane({
  torrent,
  profile,
  session,
  stats,
  activeTab,
  busy,
  onTabChange,
  onFileWantedChange,
  onFilePriorityChange
}: DetailPaneProps): JSX.Element {
  const directDownloadState = torrent ? buildDirectDownloadState(torrent, profile) : null;
  const tabs = directDownloadState ? [...baseTabs, { id: 'direct' as const, label: 'Download' }] : baseTabs;
  const activeDetailTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'general';

  useEffect(() => {
    if (activeDetailTab !== activeTab) {
      onTabChange(activeDetailTab);
    }
  }, [activeDetailTab, activeTab, onTabChange]);

  return (
    <section className="detail-pane" aria-label="Torrent details">
      <nav className="detail-tabs" aria-label="Details tabs">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={tab.id === activeDetailTab ? 'active' : undefined} onClick={() => onTabChange(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="detail-content">
        {!torrent ? <div className="empty-state">No torrent selected</div> : null}
        {torrent && activeDetailTab === 'general' ? <GeneralTab torrent={torrent} session={session} /> : null}
        {torrent && activeDetailTab === 'files' ? (
          <FilesTab
            torrent={torrent}
            busy={busy}
            onFileWantedChange={onFileWantedChange}
            onFilePriorityChange={onFilePriorityChange}
          />
        ) : null}
        {torrent && activeDetailTab === 'peers' ? <PeersTab torrent={torrent} /> : null}
        {torrent && activeDetailTab === 'trackers' ? <TrackersTab torrent={torrent} /> : null}
        {torrent && activeDetailTab === 'stats' ? <StatsTab torrent={torrent} stats={stats} /> : null}
        {torrent && activeDetailTab === 'direct' && directDownloadState ? <DirectDownloadTab state={directDownloadState} /> : null}
      </div>
    </section>
  );
}

function GeneralTab({ torrent, session }: { torrent: Torrent; session: TransmissionSession | null }): JSX.Element {
  return (
    <div className="detail-grid-layout">
      <InfoGrid
        items={[
          ['Name', torrent.name],
          ['Status', statusText(torrent)],
          ['Progress', formatPercent(torrent.percentDone)],
          ['Location', torrent.downloadDir || 'Unknown'],
          ['Hash', torrent.hashString || 'Unknown'],
          ['Private', torrent.isPrivate ? 'Yes' : 'No'],
          ['Created', formatDate(torrent.dateCreated)],
          ['Creator', torrent.creator || 'Unknown'],
          ['Daemon', session?.version ? `Transmission ${session.version}` : 'Unknown']
        ]}
      />
      <InfoGrid
        items={[
          ['Total size', formatBytes(torrentTotalSize(torrent))],
          ['Left', formatBytes(torrent.leftUntilDone)],
          ['Downloaded', formatBytes(torrent.downloadedEver)],
          ['Uploaded', formatBytes(torrent.uploadedEver)],
          ['Ratio', formatRatio(torrent.uploadRatio)],
          ['Download speed', formatRate(torrent.rateDownload)],
          ['Upload speed', formatRate(torrent.rateUpload)],
          ['ETA', formatDuration(torrent.eta)],
          ['Added', formatDate(torrent.addedDate)],
          ['Completed', formatDate(torrent.doneDate)]
        ]}
      />
      <div className="comment-panel">
        <h3>Comment</h3>
        <p>{torrent.comment || 'None'}</p>
      </div>
    </div>
  );
}

function FilesTab({
  torrent,
  busy,
  onFileWantedChange,
  onFilePriorityChange
}: {
  torrent: Torrent;
  busy: boolean;
  onFileWantedChange: (fileIndex: number, wanted: boolean) => void;
  onFilePriorityChange: (fileIndex: number, priority: -1 | 0 | 1) => void;
}): JSX.Element {
  const files = torrent.files ?? [];
  const fileStats = torrent.fileStats ?? [];

  return (
    <div className="subtable-wrap">
      <table className="subtable files-table">
        <thead>
          <tr>
            <th>Download</th>
            <th>Name</th>
            <th>Size</th>
            <th>Done</th>
            <th>Priority</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file, fileIndex) => {
            const stat = fileStats[fileIndex];
            const priority = stat?.priority ?? 0;
            return (
              <tr key={`${file.name}-${fileIndex}`}>
                <td>
                  <input
                    type="checkbox"
                    checked={stat?.wanted ?? true}
                    disabled={busy}
                    onChange={(event) => onFileWantedChange(fileIndex, event.target.checked)}
                    aria-label={`Download ${file.name}`}
                  />
                </td>
                <td className="path-cell">{file.name}</td>
                <td>{formatBytes(file.length)}</td>
                <td>{fileProgress(file, stat)}</td>
                <td>
                  <select
                    value={priority}
                    disabled={busy}
                    aria-label={`Priority for ${file.name}`}
                    onChange={(event) => onFilePriorityChange(fileIndex, Number(event.target.value) as -1 | 0 | 1)}
                  >
                    <option value={1}>{priorityLabel(1)}</option>
                    <option value={0}>{priorityLabel(0)}</option>
                    <option value={-1}>{priorityLabel(-1)}</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {files.length === 0 ? <div className="empty-state">No file details</div> : null}
    </div>
  );
}

function PeersTab({ torrent }: { torrent: Torrent }): JSX.Element {
  const peers = torrent.peers ?? [];

  return (
    <div className="subtable-wrap">
      <table className="subtable">
        <thead>
          <tr>
            <th>Address</th>
            <th>Client</th>
            <th>Progress</th>
            <th>Down</th>
            <th>Up</th>
            <th>Flags</th>
          </tr>
        </thead>
        <tbody>
          {peers.map((peer) => (
            <tr key={`${peer.address}:${peer.port}`}>
              <td>{peer.address}:{peer.port}</td>
              <td>{peer.clientName || 'Unknown'}</td>
              <td>{formatPercent(peer.progress)}</td>
              <td>{formatRate(peer.rateToClient)}</td>
              <td>{formatRate(peer.rateToPeer)}</td>
              <td>{peer.flagStr || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {peers.length === 0 ? <div className="empty-state">No peers</div> : null}
    </div>
  );
}

function TrackersTab({ torrent }: { torrent: Torrent }): JSX.Element {
  const trackerStats = torrent.trackerStats ?? [];
  const trackers = torrent.trackers ?? [];

  return (
    <div className="subtable-wrap">
      <table className="subtable">
        <thead>
          <tr>
            <th>Tracker</th>
            <th>Status</th>
            <th>Seeds</th>
            <th>Peers</th>
            <th>Next announce</th>
          </tr>
        </thead>
        <tbody>
          {(trackerStats.length ? trackerStats : trackers).map((tracker) => {
            const trackerStat = 'lastAnnounceSucceeded' in tracker ? tracker : null;
            return (
              <tr key={`${tracker.id}-${trackerStat?.announce ?? tracker.announce}`}>
                <td className="path-cell">{trackerStat?.announce ?? tracker.announce}</td>
                <td>{trackerStat ? (trackerStat.lastAnnounceSucceeded ? 'Working' : trackerStat.lastAnnounceResult || 'Waiting') : 'Known'}</td>
                <td>{trackerStat?.seederCount ?? '—'}</td>
                <td>{trackerStat?.leecherCount ?? '—'}</td>
                <td>{trackerStat ? formatDate(trackerStat.nextAnnounceTime) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {trackerStats.length === 0 && trackers.length === 0 ? <div className="empty-state">No trackers</div> : null}
    </div>
  );
}

function StatsTab({ torrent, stats }: { torrent: Torrent; stats: SessionStats | null }): JSX.Element {
  return (
    <div className="detail-grid-layout stats-layout">
      <InfoGrid
        items={[
          ['Torrent active time', formatDuration(torrent.secondsDownloading ?? 0)],
          ['Seeding time', formatDuration(torrent.secondsSeeding ?? 0)],
          ['Piece count', String(torrent.pieceCount ?? 0)],
          ['Piece size', formatBytes(torrent.pieceSize ?? 0)],
          ['Queue position', String(torrent.queuePosition ?? 0)],
          ['Last activity', formatDate(torrent.activityDate)]
        ]}
      />
      <InfoGrid
        items={[
          ['Active torrents', String(stats?.activeTorrentCount ?? 0)],
          ['Paused torrents', String(stats?.pausedTorrentCount ?? 0)],
          ['Total torrents', String(stats?.torrentCount ?? 0)],
          ['Session downloaded', formatBytes(stats?.currentStats?.downloadedBytes ?? 0)],
          ['Session uploaded', formatBytes(stats?.currentStats?.uploadedBytes ?? 0)],
          ['Cumulative downloaded', formatBytes(stats?.cumulativeStats?.downloadedBytes ?? 0)],
          ['Cumulative uploaded', formatBytes(stats?.cumulativeStats?.uploadedBytes ?? 0)]
        ]}
      />
    </div>
  );
}

function DirectDownloadTab({ state }: { state: DirectDownloadState }): JSX.Element {
  if (state.message) {
    return <div className="empty-state">{state.message}</div>;
  }

  return (
    <div className="direct-download-layout">
      <div className="direct-download-panel">
        <h3>Download folder</h3>
        {state.folderUrl ? (
          <a className="direct-download-link" href={state.folderUrl} target="_blank" rel="noreferrer" title={state.folderUrl}>
            {state.folderPath}
          </a>
        ) : null}
      </div>

      {state.links.length > 0 ? (
        <div className="subtable-wrap direct-download-table-wrap">
          <table className="subtable">
            <thead>
              <tr>
                <th>File</th>
                <th>Size</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {state.links.map((link) => (
                <tr key={link.url}>
                  <td className="path-cell">{link.label}</td>
                  <td>{formatBytes(link.size)}</td>
                  <td>
                    <a className="direct-download-link" href={link.url} target="_blank" rel="noreferrer" title={link.url}>
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
