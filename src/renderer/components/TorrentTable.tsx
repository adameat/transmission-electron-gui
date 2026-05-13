import { useMemo, type MouseEvent as ReactMouseEvent } from 'react';
import type { SizeUnitLimit, Torrent, TorrentColumnWidths, TorrentSortSettings, TorrentSortKey } from '@shared/types';
import { byteUnitIndexForValue, formatBytes, formatDate, formatDuration, formatPercent, formatRate, formatRatio, statusText, torrentListSize } from '../utils';

interface TorrentTableProps {
  torrents: Torrent[];
  selectedId: number | null;
  sort: TorrentSortSettings;
  columnWidths: TorrentColumnWidths;
  sizeUnitLimit: SizeUnitLimit;
  onSelect: (torrentId: number) => void;
  onSortChange: (sortKey: TorrentSortKey) => void;
  onColumnResize: (sortKey: TorrentSortKey, width: number, commit: boolean) => void;
}

const columns: Array<{ key: TorrentSortKey; label: string; className?: string; width: number; minWidth: number; align?: 'center' | 'right' }> = [
  { key: 'name', label: 'Name', className: 'name-column', width: 390, minWidth: 180 },
  { key: 'size', label: 'Size', width: 92, minWidth: 72, align: 'right' },
  { key: 'done', label: 'Done', width: 132, minWidth: 106, align: 'center' },
  { key: 'status', label: 'Status', width: 116, minWidth: 88 },
  { key: 'down', label: 'Down', width: 86, minWidth: 74, align: 'right' },
  { key: 'up', label: 'Up', width: 86, minWidth: 74, align: 'right' },
  { key: 'eta', label: 'ETA', width: 72, minWidth: 58, align: 'right' },
  { key: 'ratio', label: 'Ratio', width: 72, minWidth: 58, align: 'right' },
  { key: 'peers', label: 'Peers', width: 72, minWidth: 58, align: 'right' },
  { key: 'added', label: 'Added', width: 148, minWidth: 132, align: 'right' }
];

const maxSizeUnitIndexByLimit: Record<Exclude<SizeUnitLimit, 'auto'>, number> = {
  bytes: 0,
  megabytes: 2,
  gigabytes: 3
};

function classNames(...names: Array<string | undefined | false>): string | undefined {
  const filteredNames = names.filter(Boolean);
  return filteredNames.length > 0 ? filteredNames.join(' ') : undefined;
}

function sizeUnitIndexForLimit(autoUnitIndex: number, sizeUnitLimit: SizeUnitLimit): number {
  if (sizeUnitLimit === 'auto') {
    return autoUnitIndex;
  }

  // This is a maximum unit, so small torrent lists can still use B/KB while larger lists can be capped at MB or GB.
  return Math.min(autoUnitIndex, maxSizeUnitIndexByLimit[sizeUnitLimit]);
}

function sizeFractionDigits(sizeUnitLimit: SizeUnitLimit): number {
  return sizeUnitLimit === 'bytes' || sizeUnitLimit === 'megabytes' ? 0 : 1;
}

export function TorrentTable({
  torrents,
  selectedId,
  sort,
  columnWidths,
  sizeUnitLimit,
  onSelect,
  onSortChange,
  onColumnResize
}: TorrentTableProps): JSX.Element {
  const resolvedColumns = columns.map((column) => ({
    ...column,
    width: Math.max(column.minWidth, columnWidths[column.key] ?? column.width)
  }));
  const tableWidth = resolvedColumns.reduce((totalWidth, column) => totalWidth + column.width, 0);
  const { sizeUnitIndex, sizeFractionDigitCount, downloadRateUnitIndex, uploadRateUnitIndex } = useMemo(() => {
    let maxSize = 0;
    let maxDownloadRate = 0;
    let maxUploadRate = 0;

    for (const torrent of torrents) {
      const size = torrentListSize(torrent);
      const downloadRate = torrent.rateDownload || 0;
      const uploadRate = torrent.rateUpload || 0;

      if (Number.isFinite(size) && size > maxSize) {
        maxSize = size;
      }

      if (Number.isFinite(downloadRate) && downloadRate > maxDownloadRate) {
        maxDownloadRate = downloadRate;
      }

      if (Number.isFinite(uploadRate) && uploadRate > maxUploadRate) {
        maxUploadRate = uploadRate;
      }
    }

    return {
      sizeUnitIndex: sizeUnitIndexForLimit(byteUnitIndexForValue(maxSize), sizeUnitLimit),
      sizeFractionDigitCount: sizeFractionDigits(sizeUnitLimit),
      downloadRateUnitIndex: byteUnitIndexForValue(maxDownloadRate),
      uploadRateUnitIndex: byteUnitIndexForValue(maxUploadRate)
    };
  }, [sizeUnitLimit, torrents]);

  function startResize(event: ReactMouseEvent, sortKey: TorrentSortKey, startWidth: number, minWidth: number): void {
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
                <th
                  key={column.key}
                  className={classNames(column.className, column.align === 'right' && 'align-right', column.align === 'center' && 'align-center')}
                  aria-sort={isActive ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
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
              <td className="number-cell">{formatBytes(torrentListSize(torrent), sizeFractionDigitCount, sizeUnitIndex)}</td>
              <td className="progress-cell done-cell">
                <div className="progress-content">
                  <div className="progress-track" aria-label={formatPercent(torrent.percentDone)}>
                    <span style={{ width: formatPercent(torrent.percentDone) }} />
                  </div>
                  <em>{formatPercent(torrent.percentDone)}</em>
                </div>
              </td>
              <td>{statusText(torrent)}</td>
              <td className="number-cell">{formatRate(torrent.rateDownload, downloadRateUnitIndex)}</td>
              <td className="number-cell">{formatRate(torrent.rateUpload, uploadRateUnitIndex)}</td>
              <td className="number-cell">{formatDuration(torrent.eta)}</td>
              <td className="number-cell">{formatRatio(torrent.uploadRatio)}</td>
              <td className="number-cell">{torrent.peersConnected ?? 0}</td>
              <td className="date-cell">{formatDate(torrent.addedDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {torrents.length === 0 ? <div className="empty-state">No torrents</div> : null}
    </div>
  );
}
