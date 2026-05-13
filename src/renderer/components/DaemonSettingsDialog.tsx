import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DaemonSettingsPayload, EncryptionMode, TransmissionSession } from '@shared/types';

interface DaemonSettingsDialogProps {
  open: boolean;
  session: TransmissionSession | null;
  busy: boolean;
  onClose: () => void;
  onSave: (settings: DaemonSettingsPayload) => Promise<void>;
}

function numberValue(value: unknown, fallback: number): string {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? String(numericValue) : String(fallback);
}

function numericFallback(value: unknown, fallback: number, round = true): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return round ? Math.round(numericValue) : numericValue;
}

function boolValue(value: unknown): boolean {
  return value === true;
}

function encryptionValue(value: unknown): EncryptionMode {
  return value === 'tolerated' || value === 'required' ? value : 'preferred';
}

function parseNonNegativeNumber(value: string, label: string, round = true): number {
  const trimmedValue = value.trim();
  const numericValue = Number(trimmedValue);
  if (!trimmedValue || !Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error(`${label} must be 0 or greater.`);
  }

  return round ? Math.round(numericValue) : numericValue;
}

function parseEnabledNumber(enabled: boolean, value: string, label: string, fallback: number, round = true): number {
  return enabled ? parseNonNegativeNumber(value, label, round) : fallback;
}

export function DaemonSettingsDialog({ open, session, busy, onClose, onSave }: DaemonSettingsDialogProps): JSX.Element | null {
  const [downloadDir, setDownloadDir] = useState('');
  const [downloadLimitEnabled, setDownloadLimitEnabled] = useState(false);
  const [downloadLimit, setDownloadLimit] = useState('0');
  const [uploadLimitEnabled, setUploadLimitEnabled] = useState(false);
  const [uploadLimit, setUploadLimit] = useState('0');
  const [altSpeedEnabled, setAltSpeedEnabled] = useState(false);
  const [seedRatioLimited, setSeedRatioLimited] = useState(false);
  const [seedRatioLimit, setSeedRatioLimit] = useState('2');
  const [dhtEnabled, setDhtEnabled] = useState(true);
  const [pexEnabled, setPexEnabled] = useState(true);
  const [lpdEnabled, setLpdEnabled] = useState(false);
  const [encryption, setEncryption] = useState<EncryptionMode>('preferred');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !session) {
      return;
    }

    setDownloadDir(String(session['download-dir'] ?? ''));
    setDownloadLimitEnabled(boolValue(session['speed-limit-down-enabled']));
    setDownloadLimit(numberValue(session['speed-limit-down'], 0));
    setUploadLimitEnabled(boolValue(session['speed-limit-up-enabled']));
    setUploadLimit(numberValue(session['speed-limit-up'], 0));
    setAltSpeedEnabled(boolValue(session['alt-speed-enabled']));
    setSeedRatioLimited(boolValue(session.seedRatioLimited));
    setSeedRatioLimit(numberValue(session.seedRatioLimit, 2));
    setDhtEnabled(session['dht-enabled'] !== false);
    setPexEnabled(session['pex-enabled'] !== false);
    setLpdEnabled(boolValue(session['lpd-enabled']));
    setEncryption(encryptionValue(session.encryption));
    setSaving(false);
    setError('');
  }, [open, session]);

  if (!open || !session) {
    return null;
  }

  const currentSession = session;

  async function save(): Promise<void> {
    const trimmedDownloadDir = downloadDir.trim();
    if (!trimmedDownloadDir) {
      setError('Download folder is required.');
      return;
    }

    let payload: DaemonSettingsPayload;
    try {
      payload = {
        'download-dir': trimmedDownloadDir,
        'speed-limit-down-enabled': downloadLimitEnabled,
        'speed-limit-down': parseEnabledNumber(downloadLimitEnabled, downloadLimit, 'Download speed limit', numericFallback(currentSession['speed-limit-down'], 0)),
        'speed-limit-up-enabled': uploadLimitEnabled,
        'speed-limit-up': parseEnabledNumber(uploadLimitEnabled, uploadLimit, 'Upload speed limit', numericFallback(currentSession['speed-limit-up'], 0)),
        'alt-speed-enabled': altSpeedEnabled,
        seedRatioLimited,
        seedRatioLimit: parseEnabledNumber(seedRatioLimited, seedRatioLimit, 'Seed ratio limit', numericFallback(currentSession.seedRatioLimit, 2, false), false),
        'dht-enabled': dhtEnabled,
        'pex-enabled': pexEnabled,
        'lpd-enabled': lpdEnabled,
        encryption
      };
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : String(validationError));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave(payload);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  }

  const disabled = busy || saving;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal daemon-settings-modal" role="dialog" aria-modal="true" aria-label="Daemon settings">
        <header className="modal-header">
          <h2>Daemon settings</h2>
          <button type="button" className="icon-button" title="Close" aria-label="Close daemon settings" onClick={onClose} disabled={disabled}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="modal-body daemon-settings-body">
          <fieldset className="settings-group">
            <legend>Downloads</legend>
            <label className="stacked-field wide-field">
              <span>Default download folder</span>
              <input value={downloadDir} onChange={(event) => setDownloadDir(event.target.value)} disabled={disabled} />
            </label>
          </fieldset>

          <fieldset className="settings-group">
            <legend>Bandwidth</legend>
            <div className="form-grid two-columns">
              <label className="stacked-field checkbox-line">
                <span>Limit download speed</span>
                <input type="checkbox" checked={downloadLimitEnabled} onChange={(event) => setDownloadLimitEnabled(event.target.checked)} disabled={disabled} />
              </label>
              <label className="stacked-field">
                <span>Download KB/s</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={downloadLimit}
                  onChange={(event) => setDownloadLimit(event.target.value)}
                  disabled={disabled || !downloadLimitEnabled}
                />
              </label>
              <label className="stacked-field checkbox-line">
                <span>Limit upload speed</span>
                <input type="checkbox" checked={uploadLimitEnabled} onChange={(event) => setUploadLimitEnabled(event.target.checked)} disabled={disabled} />
              </label>
              <label className="stacked-field">
                <span>Upload KB/s</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={uploadLimit}
                  onChange={(event) => setUploadLimit(event.target.value)}
                  disabled={disabled || !uploadLimitEnabled}
                />
              </label>
            </div>
            <label className="settings-toggle">
              <input type="checkbox" checked={altSpeedEnabled} onChange={(event) => setAltSpeedEnabled(event.target.checked)} disabled={disabled} />
              <span>Alternative speed limits</span>
            </label>
          </fieldset>

          <fieldset className="settings-group">
            <legend>Seeding</legend>
            <div className="form-grid two-columns">
              <label className="stacked-field checkbox-line">
                <span>Stop at seed ratio</span>
                <input type="checkbox" checked={seedRatioLimited} onChange={(event) => setSeedRatioLimited(event.target.checked)} disabled={disabled} />
              </label>
              <label className="stacked-field">
                <span>Ratio limit</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={seedRatioLimit}
                  onChange={(event) => setSeedRatioLimit(event.target.value)}
                  disabled={disabled || !seedRatioLimited}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="settings-group">
            <legend>Network</legend>
            <div className="daemon-toggle-grid">
              <label className="settings-toggle">
                <input type="checkbox" checked={dhtEnabled} onChange={(event) => setDhtEnabled(event.target.checked)} disabled={disabled} />
                <span>DHT</span>
              </label>
              <label className="settings-toggle">
                <input type="checkbox" checked={pexEnabled} onChange={(event) => setPexEnabled(event.target.checked)} disabled={disabled} />
                <span>Peer exchange</span>
              </label>
              <label className="settings-toggle">
                <input type="checkbox" checked={lpdEnabled} onChange={(event) => setLpdEnabled(event.target.checked)} disabled={disabled} />
                <span>Local peer discovery</span>
              </label>
            </div>
            <label className="stacked-field wide-field">
              <span>Encryption</span>
              <select value={encryption} onChange={(event) => setEncryption(encryptionValue(event.target.value))} disabled={disabled}>
                <option value="tolerated">Tolerated</option>
                <option value="preferred">Preferred</option>
                <option value="required">Required</option>
              </select>
            </label>
          </fieldset>

          {error ? <p className="form-error">{error}</p> : null}
        </div>

        <footer className="modal-footer">
          <span className="modal-footer-spacer" />
          <button type="button" className="command-button" onClick={onClose} disabled={disabled}>
            Cancel
          </button>
          <button type="button" className="command-button primary" onClick={save} disabled={disabled}>
            Save
          </button>
        </footer>
      </section>
    </div>
  );
}
