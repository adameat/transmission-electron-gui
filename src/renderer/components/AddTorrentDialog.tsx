import { ChevronDown, FileUp, FolderInput, Link, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { OpenedTorrentFile } from '@shared/types';
import { errorMessage } from '../utils';

export interface AddTorrentPayload {
  filename?: string;
  metainfo?: string;
  downloadDir?: string;
  localTorrentFilePath?: string;
  deleteLocalTorrentFileAfterAdd?: boolean;
  paused: boolean;
}

export type AddTorrentProgress = (message: string) => void;

interface AddTorrentDialogProps {
  open: boolean;
  busy: boolean;
  defaultDownloadDir: string;
  downloadDirSuggestions: string[];
  onClose: () => void;
  onSubmit: (payload: AddTorrentPayload, reportProgress: AddTorrentProgress) => Promise<void>;
}

interface DownloadDirListBounds {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

function sameDownloadDirListBounds(firstBounds: DownloadDirListBounds | null, secondBounds: DownloadDirListBounds | null): boolean {
  if (!firstBounds || !secondBounds) {
    return firstBounds === secondBounds;
  }

  return (
    firstBounds.left === secondBounds.left &&
    firstBounds.top === secondBounds.top &&
    firstBounds.width === secondBounds.width &&
    firstBounds.maxHeight === secondBounds.maxHeight
  );
}

function normalizeSource(source: string): string {
  const trimmedSource = source.trim();
  if (/^[a-fA-F0-9]{40}$/.test(trimmedSource)) {
    return `magnet:?xt=urn:btih:${trimmedSource}`;
  }

  return trimmedSource;
}

export function AddTorrentDialog({
  open,
  busy,
  defaultDownloadDir,
  downloadDirSuggestions,
  onClose,
  onSubmit
}: AddTorrentDialogProps): JSX.Element | null {
  const downloadDirInputId = useId();
  const downloadDirListId = useId();
  const [source, setSource] = useState('');
  const [downloadDir, setDownloadDir] = useState(defaultDownloadDir);
  const [downloadDirPickerOpen, setDownloadDirPickerOpen] = useState(false);
  const [startNow, setStartNow] = useState(true);
  const [deleteLocalTorrentFileAfterAdd, setDeleteLocalTorrentFileAfterAdd] = useState(true);
  const [file, setFile] = useState<OpenedTorrentFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const downloadDirFieldRef = useRef<HTMLDivElement | null>(null);
  const downloadDirControlRef = useRef<HTMLDivElement | null>(null);
  const downloadDirInputRef = useRef<HTMLInputElement | null>(null);
  const downloadDirListRef = useRef<HTMLDivElement | null>(null);
  const downloadDirOptionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const deleteLocalTorrentFileCheckboxRef = useRef<HTMLInputElement | null>(null);
  const startNowCheckboxRef = useRef<HTMLInputElement | null>(null);
  const pendingDownloadDirFocusIndex = useRef<number | null>(null);
  const downloadDirListBoundsRef = useRef<DownloadDirListBounds | null>(null);
  const downloadDirListBoundsFrame = useRef<number | null>(null);
  const [downloadDirListBounds, setDownloadDirListBounds] = useState<DownloadDirListBounds | null>(null);
  const disabled = busy || submitting;

  useEffect(() => {
    if (open) {
      setSource('');
      setDownloadDir(defaultDownloadDir);
      setDownloadDirPickerOpen(false);
      setStartNow(true);
      setDeleteLocalTorrentFileAfterAdd(true);
      setFile(null);
      setSubmitting(false);
      setProgress('');
      setError('');
    } else {
      setDownloadDirPickerOpen(false);
    }
  }, [defaultDownloadDir, open]);

  useEffect(() => {
    if (disabled) {
      setDownloadDirPickerOpen(false);
    }
  }, [disabled]);

  useEffect(() => {
    downloadDirOptionRefs.current = downloadDirOptionRefs.current.slice(0, downloadDirSuggestions.length);
  }, [downloadDirSuggestions.length]);

  useEffect(() => {
    if (!downloadDirPickerOpen) {
      pendingDownloadDirFocusIndex.current = null;
      clearDownloadDirListBounds();
      return undefined;
    }

    updateDownloadDirListBounds();

    const updateListBounds = (event: Event): void => {
      // Scrolling the fixed list itself does not move the anchored control, so avoid layout work while browsing options.
      if (event.target instanceof Node && downloadDirListRef.current?.contains(event.target)) {
        return;
      }

      scheduleDownloadDirListBoundsUpdate();
    };
    const closePickerIfOutside = (target: EventTarget | null): void => {
      if (!(target instanceof Node)) {
        return;
      }

      if (downloadDirFieldRef.current?.contains(target) || downloadDirListRef.current?.contains(target)) {
        return;
      }

      setDownloadDirPickerOpen(false);
    };

    // The popover is fixed-positioned outside the modal body, so document-level handlers keep dismissal and placement reliable.
    const handlePointerDown = (event: PointerEvent): void => closePickerIfOutside(event.target);
    const handleFocusIn = (event: FocusEvent): void => closePickerIfOutside(event.target);

    window.addEventListener('resize', updateListBounds);
    window.addEventListener('scroll', updateListBounds, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('focusin', handleFocusIn, true);

    return () => {
      window.removeEventListener('resize', updateListBounds);
      window.removeEventListener('scroll', updateListBounds, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      cancelDownloadDirListBoundsUpdate();
    };
  }, [downloadDirPickerOpen]);

  useEffect(() => {
    if (!downloadDirPickerOpen || pendingDownloadDirFocusIndex.current === null) {
      return;
    }

    const focusIndex = pendingDownloadDirFocusIndex.current;
    pendingDownloadDirFocusIndex.current = null;
    focusDownloadDirSuggestion(focusIndex);
  }, [downloadDirPickerOpen, downloadDirSuggestions.length]);

  if (!open) {
    return null;
  }

  async function chooseFile(): Promise<void> {
    const openedFile = await window.transmission.openTorrentFile();
    if (openedFile) {
      setFile(openedFile);
      setSource(openedFile.name);
      setDeleteLocalTorrentFileAfterAdd(true);
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
          localTorrentFilePath: file?.path,
          deleteLocalTorrentFileAfterAdd: Boolean(file && deleteLocalTorrentFileAfterAdd),
          paused: !startNow
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

  function focusDownloadDirSuggestion(index: number): void {
    const suggestionCount = downloadDirSuggestions.length;
    if (suggestionCount === 0) {
      return;
    }

    const nextIndex = (index + suggestionCount) % suggestionCount;
    window.requestAnimationFrame(() => downloadDirOptionRefs.current[nextIndex]?.focus());
  }

  function applyDownloadDirListBounds(nextBounds: DownloadDirListBounds | null): void {
    if (sameDownloadDirListBounds(downloadDirListBoundsRef.current, nextBounds)) {
      return;
    }

    downloadDirListBoundsRef.current = nextBounds;
    setDownloadDirListBounds(nextBounds);
  }

  function clearDownloadDirListBounds(): void {
    cancelDownloadDirListBoundsUpdate();
    applyDownloadDirListBounds(null);
  }

  function cancelDownloadDirListBoundsUpdate(): void {
    if (downloadDirListBoundsFrame.current === null) {
      return;
    }

    window.cancelAnimationFrame(downloadDirListBoundsFrame.current);
    downloadDirListBoundsFrame.current = null;
  }

  function scheduleDownloadDirListBoundsUpdate(): void {
    if (downloadDirListBoundsFrame.current !== null) {
      return;
    }

    downloadDirListBoundsFrame.current = window.requestAnimationFrame(() => {
      downloadDirListBoundsFrame.current = null;
      updateDownloadDirListBounds();
    });
  }

  function updateDownloadDirListBounds(): void {
    const controlBounds = downloadDirControlRef.current?.getBoundingClientRect();
    if (!controlBounds) {
      applyDownloadDirListBounds(null);
      return;
    }

    // Keep the full recent-folder list outside modal-body clipping while still fitting it within the viewport.
    const viewportMargin = 12;
    const listGap = 4;
    const preferredMaxHeight = Math.min(260, Math.max(120, Math.floor(window.innerHeight * 0.42)));
    const spaceBelow = window.innerHeight - controlBounds.bottom - listGap - viewportMargin;
    const spaceAbove = controlBounds.top - listGap - viewportMargin;
    const openAbove = spaceBelow < Math.min(preferredMaxHeight, 160) && spaceAbove > spaceBelow;
    const availableHeight = Math.max(0, Math.min(preferredMaxHeight, openAbove ? spaceAbove : spaceBelow));
    const left = Math.max(viewportMargin, Math.min(controlBounds.left, window.innerWidth - viewportMargin - controlBounds.width));
    const unclampedTop = openAbove ? controlBounds.top - listGap - availableHeight : controlBounds.bottom + listGap;
    const top = Math.max(viewportMargin, Math.min(unclampedTop, window.innerHeight - viewportMargin - availableHeight));

    applyDownloadDirListBounds({
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(Math.min(controlBounds.width, window.innerWidth - viewportMargin - left)),
      maxHeight: Math.round(availableHeight)
    });
  }

  function selectedDownloadDirSuggestionIndex(): number {
    const selectedIndex = downloadDirSuggestions.findIndex((suggestion) => suggestion === downloadDir);
    return selectedIndex >= 0 ? selectedIndex : 0;
  }

  function openDownloadDirPicker(focusIndex = selectedDownloadDirSuggestionIndex()): void {
    if (!hasDownloadDirSuggestions) {
      return;
    }

    updateDownloadDirListBounds();
    if (downloadDirPickerOpen) {
      focusDownloadDirSuggestion(focusIndex);
      return;
    }

    pendingDownloadDirFocusIndex.current = focusIndex;
    setDownloadDirPickerOpen(true);
  }

  function handleDownloadDirKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      setDownloadDirPickerOpen(false);
      downloadDirInputRef.current?.focus();
      return;
    }

    if (!hasDownloadDirSuggestions) {
      return;
    }

    const focusedOptionIndex = downloadDirOptionRefs.current.findIndex((option) => option === document.activeElement);
    const isInputFocused = document.activeElement === downloadDirInputRef.current;

    if ((event.key === 'Enter' || event.key === ' ') && focusedOptionIndex >= 0) {
      event.preventDefault();
      selectDownloadDirSuggestion(downloadDirSuggestions[focusedOptionIndex]);
      return;
    }

    if (event.key === 'Tab' && focusedOptionIndex >= 0) {
      event.preventDefault();
      setDownloadDirPickerOpen(false);
      // The fixed-position list is rendered after the footer, so restore the dialog's visual tab order manually.
      // The cleanup checkbox only exists for local file adds; otherwise the next visual control is Start torrent.
      const nextControl = event.shiftKey
        ? downloadDirInputRef.current
        : (deleteLocalTorrentFileCheckboxRef.current ?? startNowCheckboxRef.current);
      window.requestAnimationFrame(() => nextControl?.focus());
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (isInputFocused && (event.shiftKey || event.ctrlKey || event.metaKey)) {
        return;
      }

      const isArrowShortcut = !event.shiftKey && !event.ctrlKey && !event.metaKey;
      const isOpeningFromInput = isInputFocused && !downloadDirPickerOpen && isArrowShortcut;
      const shouldHandleArrow = isOpeningFromInput || downloadDirPickerOpen || focusedOptionIndex >= 0 || (event.altKey && isArrowShortcut);
      if (!shouldHandleArrow) {
        return;
      }

      // Match common combobox behavior: plain or Alt+Arrow opens the list, while modified text-editing arrows stay with the input.
      event.preventDefault();
      const optionOffset = event.key === 'ArrowDown' ? 1 : -1;
      const focusIndex = focusedOptionIndex >= 0 ? focusedOptionIndex + optionOffset : selectedDownloadDirSuggestionIndex();
      openDownloadDirPicker(focusIndex);
    } else if (event.key === 'Home' && focusedOptionIndex >= 0) {
      event.preventDefault();
      focusDownloadDirSuggestion(0);
    } else if (event.key === 'End' && focusedOptionIndex >= 0) {
      event.preventDefault();
      focusDownloadDirSuggestion(downloadDirSuggestions.length - 1);
    }
  }

  function selectDownloadDirSuggestion(suggestion: string): void {
    setDownloadDir(suggestion);
    setDownloadDirPickerOpen(false);
    window.requestAnimationFrame(() => downloadDirInputRef.current?.focus());
  }

  function toggleDownloadDirPicker(): void {
    if (downloadDirPickerOpen) {
      setDownloadDirPickerOpen(false);
      return;
    }

    openDownloadDirPicker();
  }

  const hasDownloadDirSuggestions = downloadDirSuggestions.length > 0;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal add-torrent-modal" role="dialog" aria-modal="true" aria-label="Add torrent">
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

          <div ref={downloadDirFieldRef} className="stacked-field download-dir-field" onKeyDown={handleDownloadDirKeyDown}>
            <label htmlFor={downloadDirInputId}>Download folder</label>
            <div className="source-row">
              <FolderInput size={17} aria-hidden="true" />
              <div ref={downloadDirControlRef} className="download-dir-control">
                <input
                  id={downloadDirInputId}
                  ref={downloadDirInputRef}
                  value={downloadDir}
                  onChange={(event) => setDownloadDir(event.target.value)}
                  disabled={disabled}
                />
                <button
                  type="button"
                  className="icon-button download-dir-toggle"
                  title="Download folder suggestions"
                  aria-label="Download folder suggestions"
                  aria-haspopup="listbox"
                  aria-expanded={downloadDirPickerOpen}
                  aria-controls={downloadDirPickerOpen && hasDownloadDirSuggestions ? downloadDirListId : undefined}
                  onClick={toggleDownloadDirPicker}
                  disabled={disabled || !hasDownloadDirSuggestions}
                >
                  <ChevronDown size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="modal-options">
            {file ? (
              <label>
                <input
                  ref={deleteLocalTorrentFileCheckboxRef}
                  type="checkbox"
                  checked={deleteLocalTorrentFileAfterAdd}
                  onChange={(event) => setDeleteLocalTorrentFileAfterAdd(event.target.checked)}
                  disabled={disabled}
                />
                Delete local .torrent file after adding
              </label>
            ) : null}
            <label>
              <input
                ref={startNowCheckboxRef}
                type="checkbox"
                checked={startNow}
                onChange={(event) => setStartNow(event.target.checked)}
                disabled={disabled}
              />
              Start torrent
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
        {downloadDirPickerOpen && hasDownloadDirSuggestions ? (
          // Native datalist filters by the current input text; this list intentionally stays complete for issue #13.
          <div
            id={downloadDirListId}
            ref={downloadDirListRef}
            className="download-dir-list"
            role="listbox"
            aria-label="Download folder suggestions"
            style={downloadDirListBounds ?? undefined}
            onKeyDown={handleDownloadDirKeyDown}
          >
            {downloadDirSuggestions.map((suggestion, suggestionIndex) => (
              <div
                key={suggestion}
                ref={(element) => {
                  downloadDirOptionRefs.current[suggestionIndex] = element;
                }}
                tabIndex={-1}
                className={`download-dir-option${suggestion === downloadDir ? ' selected' : ''}`}
                role="option"
                aria-selected={suggestion === downloadDir}
                onClick={() => selectDownloadDirSuggestion(suggestion)}
              >
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
