import { FileUp, FolderInput, Link, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { OpenedTorrentFile } from '@shared/types';
import { errorMessage } from '../utils';

export interface AddTorrentPayload {
  filename?: string;
  metainfo?: string;
  downloadDir?: string;
  paused: boolean;
  peerLimit?: number;
}

export type AddTorrentProgress = (message: string) => void;

interface AddTorrentDialogProps {
  open: boolean;
  busy: boolean;
  defaultDownloadDir: string;
  onClose: () => void;
  onSubmit: (payload: AddTorrentPayload, reportProgress: AddTorrentProgress) => Promise<void>;
}

function normalizeSource(source: string): string {
  const trimmedSource = source.trim();
  if (/^[a-fA-F0-9]{40}$/.test(trimmedSource)) {
    return `magnet:?xt=urn:btih:${trimmedSource}`;
  }

  return trimmedSource;
}

export function AddTorrentDialog({ open, busy, defaultDownloadDir, onClose, onSubmit }: AddTorrentDialogProps): JSX.Element | null {
  const [source, setSource] = useState('');
  const [downloadDir, setDownloadDir] = useState(defaultDownloadDir);
  const [startNow, setStartNow] = useState(true);
  const [peerLimit, setPeerLimit] = useState('');
  const [file, setFile] = useState<OpenedTorrentFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSource('');
      setDownloadDir(defaultDownloadDir);
      setStartNow(true);
      setPeerLimit('');
      setFile(null);
      setSubmitting(false);
      setProgress('');
      setError('');
    }
  }, [defaultDownloadDir, open]);

  if (!open) {
    return null;
  }

  async function chooseFile(): Promise<void> {
    const openedFile = await window.transmission.openTorrentFile();
    if (openedFile) {
      setFile(openedFile);
      setSource(openedFile.name);
      setError('');
    }
  }

  async function submit(): Promise<void> {
    const normalizedSource = normalizeSource(source);
    if (!file?.metainfo && !normalizedSource) {
      setError('Torrent source is required.');
      return;
    }

    setSubmitting(true);
    setProgress('Requesting Transmission...');
    setError('');

    try {
      await onSubmit(
        {
          filename: file?.metainfo ? undefined : normalizedSource,
          metainfo: file?.metainfo,
          downloadDir: downloadDir.trim() || undefined,
          paused: !startNow,
          peerLimit: peerLimit ? Number(peerLimit) : undefined
        },
        setProgress
      );
      setSubmitting(false);
      onClose();
    } catch (submitError) {
      setProgress('');
      setError(errorMessage(submitError));
      setSubmitting(false);
    }
  }

  const disabled = busy || submitting;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-label="Add torrent">
        <header className="modal-header">
          <h2>Add torrent</h2>
          <button type="button" className="icon-button" title="Close" onClick={onClose} disabled={disabled}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="modal-body">
          <label className="stacked-field">
            <span>URL, magnet, hash, or file</span>
            <div className="source-row">
              <Link size={17} aria-hidden="true" />
              <input value={source} onChange={(event) => setSource(event.target.value)} disabled={disabled || Boolean(file)} />
              <button type="button" className="command-button" onClick={chooseFile} disabled={disabled}>
                <FileUp size={17} aria-hidden="true" />
                File
              </button>
            </div>
          </label>

          {file ? <div className="selected-file">{file.path}</div> : null}

          <label className="stacked-field">
            <span>Download folder</span>
            <div className="source-row">
              <FolderInput size={17} aria-hidden="true" />
              <input value={downloadDir} onChange={(event) => setDownloadDir(event.target.value)} disabled={disabled} />
            </div>
          </label>

          <div className="modal-options">
            <label>
              <input type="checkbox" checked={startNow} onChange={(event) => setStartNow(event.target.checked)} disabled={disabled} />
              Start torrent
            </label>
            <label>
              <span>Peer limit</span>
              <input type="number" min={0} value={peerLimit} onChange={(event) => setPeerLimit(event.target.value)} disabled={disabled} />
            </label>
          </div>

          {progress ? <p className="form-progress" role="status">{progress}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
        </div>

        <footer className="modal-footer">
          <button type="button" className="command-button" onClick={onClose} disabled={disabled}>
            Cancel
          </button>
          <button type="button" className="command-button primary" onClick={submit} disabled={disabled}>
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </footer>
      </section>
    </div>
  );
}
