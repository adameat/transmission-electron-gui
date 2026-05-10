import { AlertTriangle, CheckCircle2, CirclePause, Clock3, Download, Gauge, ListFilter, Radio } from 'lucide-react';
import type { TorrentFilter } from '@shared/types';
import { FILTER_LABELS } from '../utils';

const FILTER_ICONS: Record<TorrentFilter, typeof ListFilter> = {
  all: ListFilter,
  downloading: Download,
  completed: CheckCircle2,
  active: Gauge,
  inactive: Radio,
  stopped: CirclePause,
  error: AlertTriangle,
  waiting: Clock3
};

interface FilterSidebarProps {
  activeFilter: TorrentFilter;
  counts: Record<TorrentFilter, number>;
  onFilterChange: (filter: TorrentFilter) => void;
}

export function FilterSidebar({ activeFilter, counts, onFilterChange }: FilterSidebarProps): JSX.Element {
  return (
    <aside className="filter-sidebar" aria-label="Torrent filters">
      {(Object.keys(FILTER_LABELS) as TorrentFilter[]).map((filter) => {
        const Icon = FILTER_ICONS[filter];
        return (
          <button
            key={filter}
            type="button"
            className={filter === activeFilter ? 'filter-row active' : 'filter-row'}
            onClick={() => onFilterChange(filter)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{FILTER_LABELS[filter]}</span>
            <strong>{counts[filter] ?? 0}</strong>
          </button>
        );
      })}
    </aside>
  );
}
