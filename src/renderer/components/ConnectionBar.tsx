import { Plug, Server, Settings, Unplug } from 'lucide-react';
import type { TransmissionProfile } from '@shared/types';

interface ConnectionBarProps {
  profile: TransmissionProfile;
  profiles: TransmissionProfile[];
  connected: boolean;
  busy: boolean;
  onProfileSelect: (profileId: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onManageConnections: () => void;
}

export function ConnectionBar({
  profile,
  profiles,
  connected,
  busy,
  onProfileSelect,
  onConnect,
  onDisconnect,
  onManageConnections
}: ConnectionBarProps): JSX.Element {
  return (
    <section className="connection-bar" aria-label="Connection">
      <div className="profile-picker">
        <Server size={17} aria-hidden="true" />
        <select value={profile.id} onChange={(event) => onProfileSelect(event.target.value)} aria-label="Connection profile" disabled={busy}>
          {profiles.map((savedProfile) => (
            <option key={savedProfile.id} value={savedProfile.id}>
              {savedProfile.name}
            </option>
          ))}
        </select>
      </div>

      <button type="button" className="command-button" onClick={onManageConnections} disabled={busy}>
        <Settings size={17} aria-hidden="true" />
        Connections
      </button>

      <div className="connection-actions">
        {connected ? (
          <button type="button" className="command-button danger" onClick={onDisconnect} disabled={busy}>
            <Unplug size={17} aria-hidden="true" />
            Disconnect
          </button>
        ) : (
          <button type="button" className="command-button primary" onClick={onConnect} disabled={busy}>
            <Plug size={17} aria-hidden="true" />
            Connect
          </button>
        )}
      </div>
    </section>
  );
}
