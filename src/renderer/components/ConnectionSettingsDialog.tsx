import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TransmissionProfile } from '@shared/types';

interface ConnectionSettingsDialogProps {
  open: boolean;
  profiles: TransmissionProfile[];
  activeProfileId: string;
  busy: boolean;
  onClose: () => void;
  onSave: (profiles: TransmissionProfile[]) => Promise<void>;
}

function createProfile(): TransmissionProfile {
  return {
    id: crypto.randomUUID(),
    name: 'New connection',
    protocol: 'http',
    host: '127.0.0.1',
    port: 9091,
    rpcPath: '/transmission/rpc',
    username: '',
    password: '',
    directDownloadUrl: '',
    directDownloadLocalPath: ''
  };
}

function normalizeProfile(profile: TransmissionProfile): TransmissionProfile {
  return {
    ...profile,
    id: profile.id || crypto.randomUUID(),
    name: profile.name.trim() || 'Transmission daemon',
    host: profile.host.trim(),
    port: Number(profile.port) || 9091,
    rpcPath: profile.rpcPath.startsWith('/') ? profile.rpcPath : `/${profile.rpcPath || 'transmission/rpc'}`,
    directDownloadUrl: (profile.directDownloadUrl ?? '').trim(),
    directDownloadLocalPath: (profile.directDownloadLocalPath ?? '').trim()
  };
}

function isValidDirectDownloadUrl(value: string): boolean {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function ConnectionSettingsDialog({
  open,
  profiles,
  activeProfileId,
  busy,
  onClose,
  onSave
}: ConnectionSettingsDialogProps): JSX.Element | null {
  const [draftProfiles, setDraftProfiles] = useState<TransmissionProfile[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextProfiles = profiles.length ? profiles.map((profile) => normalizeProfile(profile)) : [createProfile()];
    setDraftProfiles(nextProfiles);
    setSelectedId(nextProfiles.find((profile) => profile.id === activeProfileId)?.id ?? nextProfiles[0].id);
    setSaving(false);
    setError('');
  }, [activeProfileId, open, profiles]);

  const selectedProfile = useMemo(
    () => draftProfiles.find((profile) => profile.id === selectedId) ?? draftProfiles[0],
    [draftProfiles, selectedId]
  );

  if (!open) {
    return null;
  }

  function updateSelected(patch: Partial<TransmissionProfile>): void {
    setDraftProfiles((currentProfiles) =>
      currentProfiles.map((profile) => (profile.id === selectedProfile.id ? { ...profile, ...patch } : profile))
    );
  }

  function addProfile(): void {
    const nextProfile = createProfile();
    setDraftProfiles((currentProfiles) => [...currentProfiles, nextProfile]);
    setSelectedId(nextProfile.id);
    setError('');
  }

  function deleteProfile(): void {
    if (draftProfiles.length <= 1) {
      setError('At least one connection is required.');
      return;
    }

    const nextProfiles = draftProfiles.filter((profile) => profile.id !== selectedProfile.id);
    setDraftProfiles(nextProfiles);
    setSelectedId(nextProfiles[0].id);
    setError('');
  }

  async function save(): Promise<void> {
    const normalizedProfiles = draftProfiles.map(normalizeProfile);
    const names = normalizedProfiles.map((profile) => profile.name.toLowerCase());

    if (normalizedProfiles.some((profile) => !profile.host.trim())) {
      setError('Host is required.');
      return;
    }

    if (new Set(names).size !== names.length) {
      setError('Connection names must be unique.');
      return;
    }

    if (normalizedProfiles.some((profile) => Boolean(profile.directDownloadUrl) !== Boolean(profile.directDownloadLocalPath))) {
      setError('Direct download URL and local path must be set together.');
      return;
    }

    if (normalizedProfiles.some((profile) => !isValidDirectDownloadUrl(profile.directDownloadUrl))) {
      setError('Direct download URL must be an HTTP or HTTPS URL.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave(normalizedProfiles);
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
      <section className="modal connections-modal" role="dialog" aria-modal="true" aria-label="Connection settings">
        <header className="modal-header">
          <h2>Connections</h2>
          <button type="button" className="icon-button" title="Close" onClick={onClose} disabled={disabled}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="modal-body connections-layout">
          <aside className="connections-list" aria-label="Saved connections">
            {draftProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={profile.id === selectedProfile.id ? 'connection-list-row active' : 'connection-list-row'}
                onClick={() => setSelectedId(profile.id)}
                disabled={disabled}
              >
                <strong>{profile.name || 'Transmission daemon'}</strong>
                <span>{profile.id === activeProfileId ? 'Selected' : `${profile.protocol}://${profile.host}:${profile.port}`}</span>
              </button>
            ))}
            <button type="button" className="command-button" onClick={addProfile} disabled={disabled}>
              <Plus size={17} aria-hidden="true" />
              New
            </button>
          </aside>

          {selectedProfile ? (
            <div className="connections-form">
              <label className="stacked-field wide-field">
                <span>Name</span>
                <input value={selectedProfile.name} onChange={(event) => updateSelected({ name: event.target.value })} disabled={disabled} />
              </label>

              <div className="form-grid two-columns">
                <label className="stacked-field checkbox-line">
                  <span>Use SSL</span>
                  <input
                    type="checkbox"
                    checked={selectedProfile.protocol === 'https'}
                    onChange={(event) => updateSelected({ protocol: event.target.checked ? 'https' : 'http' })}
                    disabled={disabled}
                  />
                </label>
                <label className="stacked-field">
                  <span>Port</span>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={selectedProfile.port}
                    onChange={(event) => updateSelected({ port: Number(event.target.value) })}
                    disabled={disabled}
                  />
                </label>
              </div>

              <label className="stacked-field wide-field">
                <span>Host</span>
                <input value={selectedProfile.host} onChange={(event) => updateSelected({ host: event.target.value })} disabled={disabled} />
              </label>

              <label className="stacked-field wide-field">
                <span>RPC path</span>
                <input value={selectedProfile.rpcPath} onChange={(event) => updateSelected({ rpcPath: event.target.value })} disabled={disabled} />
              </label>

              <div className="form-grid two-columns">
                <label className="stacked-field">
                  <span>User</span>
                  <input value={selectedProfile.username} onChange={(event) => updateSelected({ username: event.target.value })} disabled={disabled} />
                </label>
                <label className="stacked-field">
                  <span>Password</span>
                  <input
                    type="password"
                    value={selectedProfile.password}
                    onChange={(event) => updateSelected({ password: event.target.value })}
                    disabled={disabled}
                  />
                </label>
              </div>

              <fieldset className="settings-group connection-settings-group">
                <legend>Direct downloads</legend>
                <label className="stacked-field wide-field">
                  <span>URL root</span>
                  <input
                    value={selectedProfile.directDownloadUrl}
                    onChange={(event) => updateSelected({ directDownloadUrl: event.target.value })}
                    disabled={disabled}
                  />
                </label>
                <label className="stacked-field wide-field">
                  <span>Local path root</span>
                  <input
                    value={selectedProfile.directDownloadLocalPath}
                    onChange={(event) => updateSelected({ directDownloadLocalPath: event.target.value })}
                    disabled={disabled}
                  />
                </label>
              </fieldset>

              <button type="button" className="command-button danger delete-connection" onClick={deleteProfile} disabled={disabled}>
                <Trash2 size={17} aria-hidden="true" />
                Delete
              </button>
            </div>
          ) : null}
        </div>

        <footer className="modal-footer">
          {error ? <p className="form-error">{error}</p> : null}
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