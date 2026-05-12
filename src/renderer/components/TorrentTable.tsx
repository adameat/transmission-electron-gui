import type { Torrent, TorrentColumnWidths, TorrentSortSettings, TorrentSortKey } from '@shared/types';
import { formatBytes, formatDate, formatDuration, formatPercent, formatRate, formatRatio, statusText } from '../utils';

interface TorrentTableProps {
  torrents: Torrent[];
  selectedId: number | null;
  sort: TorrentSortSettings;
  columnWidths: TorrentColumnWidths;
  onSelect: (torrentId: number) => void;
  onSortChange: (sortKey: TorrentSortKey) => void;
  onColumnResize: (sortKey: TorrentSortKey, width: number, commit: boolean) => void;
}

const columns: Array<{ key: TorrentSortKey; label: string; className?: string; width: number; minWidth: number }> = [
  { key: 'name', label: 'Name', className: 'name-column', width: 390, minWidth: 180 },
  { key: 'size', label: 'Size', width: 92, minWidth: 72 },
  { key: 'done', label: 'Done', width: 132, minWidth: 106 },
  { key: 'status', label: 'Status', width: 116, minWidth: 88 },
  { key: 'down', label: 'Down', width: 86, minWidth: 74 },
  { key: 'up', label: 'Up', width: 86, minWidth: 74 },
  { key: 'eta', label: 'ETA', width: 72, minWidth: 58 },
  { key: 'ratio', label: 'Ratio', width: 72, minWidth: 58 },
  { key: 'peers', label: 'Peers', width: 72, minWidth: 58 },
  { key: 'added', label: 'Added', width: 172, minWidth: 132 }
];

export function TorrentTable({ torrents, selectedId, sort, columnWidths, onSelect, onSortChange, onColumnResize }: TorrentTableProps): JSX.Element {
  const resolvedColumns = columns.map((column) => ({
    ...column,
    width: Math.max(column.minWidth, columnWidths[column.key] ?? column.width)
  }));
  const tableWidth = resolvedColumns.reduce((totalWidth, column) => totalWidth + column.width, 0);

  function startResize(event: React.MouseEvent, sortKey: TorrentSortKey, startWidth: number, minWidth: number): void {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;

    function nextWidth(clientX: number): number {
      return Math.max(minWidth, Math.round(startWidth + clientX - startX));
    }

    function handleMouseMove(moveEvent: MouseEvent): void {
      onColumnResize(sortKey, nextWidth(moveEvent.clientX), false);
    }

    function handleMouseUp(upEvent: MouseEvent): void {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('is-resizing-column');
      onColumnResize(sortKey, nextWidth(upEvent.clientX), true);
    }

    document.body.classList.add('is-resizing-column');
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  return (
    <div className="torrent-table-wrap">
      <table className="torrent-table" style={{ width: `max(100%, ${tableWidth}px)` }}>
        <colgroup>
          {resolvedColumns.map((column) => (
            <col key={column.key} style={{ width: `${column.width}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {resolvedColumns.map((column) => {
              const isActive = sort.key === column.key;
              return (
                <th key={column.key} className={column.className} aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className={isActive ? 'column-sort active' : 'column-sort'} onClick={() => onSortChange(column.key)}>
                    <span>{column.label}</span>
                    <span className="sort-indicator" aria-hidden="true">
                      {isActive ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </button>
                  <span
                    className="column-resizer"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize ${column.label} column`}
                    onMouseDown={(event) => startResize(event, column.key, column.width, column.minWidth)}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {torrents.map((torrent) => (
            <tr
              key={torrent.id}
              className={torrent.id === selectedId ? 'selected' : undefined}
              onClick={() => onSelect(torrent.id)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onSelect(torrent.id);
                }
              }}
            >
              <td className="name-cell">
                <span className="torrent-name">{torrent.name}</span>
                {torrent.error ? <span className="torrent-error">{torrent.errorString || 'Error'}</span> : null}
              </td>
              <td>{formatBytes(torrent.sizeWhenDone || torrent.totalSize)}</td>
              <td className="progress-cell">
                <div className="progress-content">
                  <div className="progress-track" aria-label={formatPercent(torrent.percentDone)}>
                    <span style={{ width: formatPercent(torrent.percentDone) }} />
                  </div>
                  <em>{formatPercent(torrent.percentDone)}</em>
                </div>
              </td>
              <td>{statusText(torrent)}</td>
              <td>{formatRate(torrent.rateDownload)}</td>
              <td>{formatRate(torrent.rateUpload)}</td>
              <td>{formatDuration(torrent.eta)}</td>
              <td>{formatRatio(torrent.uploadRatio)}</td>
              <td>{torrent.peersConnected ?? 0}</td>
              <td>{formatDate(torrent.addedDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {torrents.length === 0 ? <div className="empty-state">No torrents</div> : null}
    </div>
  );
}
