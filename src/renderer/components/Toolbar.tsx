import { Pause, Play, Plus, RadioTower, RefreshCw, Settings2, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';

interface ToolbarProps {
  connected: boolean;
  hasSelection: boolean;
  busy: boolean;
  onAdd: () => void;
  onRefresh: () => void;
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
  onVerify: () => void;
  onReannounce: () => void;
  onOpenSettings: () => void;
  onOpenDaemonSettings: () => void;
}

export function Toolbar({
  connected,
  hasSelection,
  busy,
  onAdd,
  onRefresh,
  onStart,
  onStop,
  onRemove,
  onVerify,
  onReannounce,
  onOpenSettings,
  onOpenDaemonSettings
}: ToolbarProps): JSX.Element {
  return (
    <section className="toolbar" aria-label="Torrent actions">
      <button type="button" className="tool-button" title="Add torrent" onClick={onAdd} disabled={!connected || busy}>
        <Plus size={18} aria-hidden="true" />
        <span>Add</span>
      </button>
      <button type="button" className="tool-button" title="Start torrent" onClick={onStart} disabled={!connected || !hasSelection || busy}>
        <Play size={18} aria-hidden="true" />
        <span>Start</span>
      </button>
      <button type="button" className="tool-button" title="Stop torrent" onClick={onStop} disabled={!connected || !hasSelection || busy}>
        <Pause size={18} aria-hidden="true" />
        <span>Stop</span>
      </button>
      <button type="button" className="tool-button" title="Remove torrent" onClick={onRemove} disabled={!connected || !hasSelection || busy}>
        <Trash2 size={18} aria-hidden="true" />
        <span>Remove</span>
      </button>
      <span className="toolbar-separator" />
      <button type="button" className="tool-button" title="Verify torrent" onClick={onVerify} disabled={!connected || !hasSelection || busy}>
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Verify</span>
      </button>
      <button type="button" className="tool-button" title="Reannounce torrent" onClick={onReannounce} disabled={!connected || !hasSelection || busy}>
        <RadioTower size={18} aria-hidden="true" />
        <span>Announce</span>
      </button>
      <span className="toolbar-spacer" />
      <button type="button" className="tool-button" title="App settings" onClick={onOpenSettings} disabled={busy}>
        <Settings2 size={18} aria-hidden="true" />
        <span>Settings</span>
      </button>
      <button type="button" className="tool-button" title="Daemon settings" onClick={onOpenDaemonSettings} disabled={!connected || busy}>
        <SlidersHorizontal size={18} aria-hidden="true" />
        <span>Daemon</span>
      </button>
      <button type="button" className="tool-button" title="Refresh" onClick={onRefresh} disabled={!connected || busy}>
        <RefreshCw size={18} aria-hidden="true" />
        <span>Refresh</span>
      </button>
    </section>
  );
}
