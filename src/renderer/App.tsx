import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppSettings,
  ConnectionResult,
  InterfaceTheme,
  SessionStats,
  Torrent,
  TorrentAddResult,
  TorrentColumnWidths,
  TorrentFilter,
  TorrentGetResult,
  TorrentSortKey,
  TorrentSortSettings,
  TransmissionProfile,
  TransmissionSession
} from '@shared/types';
import { collectDownloadDirs, maxTorrentDownloadDirSuggestionScan } from '@shared/downloadDirs';
import { AddTorrentDialog, type AddTorrentPayload, type AddTorrentProgress } from './components/AddTorrentDialog';
import { AppSettingsDialog } from './components/AppSettingsDialog';
import { ConnectionBar } from './components/ConnectionBar';
import { ConnectionSettingsDialog } from './components/ConnectionSettingsDialog';
import { DetailPane, type DetailTab } from './components/DetailPane';
import { FilterSidebar } from './components/FilterSidebar';
import { StatusBar, type StatusActivity } from './components/StatusBar';
import { Toolbar } from './components/Toolbar';
import { TorrentTable } from './components/TorrentTable';
import { torrentDetailFields, torrentFields } from './rpcFields';
import { countFilters, errorMessage, torrentListSize, torrentMatchesFilter } from './utils';
import './App.css';

const defaultProfile: TransmissionProfile = {
  id: 'local-default',
  name: 'Local daemon',
  protocol: 'http',
  host: '127.0.0.1',
  port: 9091,
  rpcPath: '/transmission/rpc',
  username: '',
  password: ''
};

const defaultSettings: AppSettings = {
  profiles: [defaultProfile],
  activeProfileId: defaultProfile.id,
  interfaceTheme: 'system',
  refreshIntervalSeconds: 5,
  torrentSort: {
    key: 'name',
    direction: 'asc'
  },
  torrentColumnWidths: {},
  recentDownloadDirs: []
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const progressFrameFallbackMs = 50;

interface RefreshOptions {
  force?: boolean;
  showProgress?: boolean;
  label?: string;
}

type SettingsUpdate = AppSettings | ((currentSettings: AppSettings) => AppSettings);

function waitForProgressFrame(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let frameId = 0;

    const finish = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(frameId);
      resolve();
    };

    const timeoutId = window.setTimeout(finish, progressFrameFallbackMs);
    frameId = window.requestAnimationFrame(finish);
  });
}

function ensureProfile(profile: TransmissionProfile): TransmissionProfile {
  return {
    ...profile,
    id: profile.id || crypto.randomUUID(),
    name: profile.name.trim() || 'Transmission daemon',
    host: profile.host.trim() || '127.0.0.1',
    port: Number(profile.port) || 9091,
    rpcPath: profile.rpcPath.startsWith('/') ? profile.rpcPath : `/${profile.rpcPath || 'transmission/rpc'}`
  };
}

function sortValue(torrent: Torrent, sortKey: TorrentSortKey): number | string {
  switch (sortKey) {
    case 'size':
      return torrentListSize(torrent);
    case 'done':
      return torrent.percentDone || 0;
    case 'status':
      return `${torrent.error ? '0' : '1'}-${torrent.status}-${torrent.name}`;
    case 'down':
      return torrent.rateDownload || 0;
    case 'up':
      return torrent.rateUpload || 0;
    case 'eta':
      return torrent.eta < 0 ? Number.POSITIVE_INFINITY : torrent.eta || 0;
    case 'ratio':
      return torrent.uploadRatio || 0;
    case 'peers':
      return torrent.peersConnected || 0;
    case 'added':
      return torrent.addedDate || 0;
    case 'name':
    default:
      return torrent.name || '';
  }
}

function compareTorrents(firstTorrent: Torrent, secondTorrent: Torrent, sort: TorrentSortSettings): number {
  const firstValue = sortValue(firstTorrent, sort.key);
  const secondValue = sortValue(secondTorrent, sort.key);
  const direction = sort.direction === 'asc' ? 1 : -1;

  if (typeof firstValue === 'string' || typeof secondValue === 'string') {
    const comparison = collator.compare(String(firstValue), String(secondValue));
    return comparison !== 0 ? comparison * direction : firstTorrent.id - secondTorrent.id;
  }

  const comparison = firstValue - secondValue;
  return comparison !== 0 ? comparison * direction : collator.compare(firstTorrent.name, secondTorrent.name);
}

function transmissionApi(): Window['transmission'] {
  if (!window.transmission) {
    throw new Error('Desktop integration failed to start. Please restart the application.');
  }

  return window.transmission;
}

function* downloadDirSuggestionSources(
  defaultDownloadDir: string,
  recentDownloadDirs: string[],
  torrents: Torrent[],
  sessionDefaultDownloadDir: string
): Generator<string | undefined> {
  yield defaultDownloadDir;
  yield* recentDownloadDirs;

  // Recent folders are the high-confidence source; current torrents are a fallback, so cap the scan to keep render work predictable.
  let scannedTorrents = 0;
  for (const torrent of torrents) {
    if (scannedTorrents >= maxTorrentDownloadDirSuggestionScan) {
      break;
    }

    scannedTorrents += 1;
    yield torrent.downloadDir;
  }

  yield sessionDefaultDownloadDir;
}

function sameDownloadDirs(firstDownloadDirs: string[], secondDownloadDirs: string[]): boolean {
  return (
    firstDownloadDirs.length === secondDownloadDirs.length &&
    firstDownloadDirs.every((downloadDir, index) => downloadDir === secondDownloadDirs[index])
  );
}

function sameTorrentSort(firstSort: TorrentSortSettings, secondSort: TorrentSortSettings): boolean {
  return firstSort.key === secondSort.key && firstSort.direction === secondSort.direction;
}

function sameColumnWidths(firstColumnWidths: TorrentColumnWidths, secondColumnWidths: TorrentColumnWidths): boolean {
  const firstKeys = Object.keys(firstColumnWidths) as TorrentSortKey[];
  const secondKeys = Object.keys(secondColumnWidths) as TorrentSortKey[];

  return (
    firstKeys.length === secondKeys.length &&
    firstKeys.every(
      (columnKey) => Object.prototype.hasOwnProperty.call(secondColumnWidths, columnKey) && firstColumnWidths[columnKey] === secondColumnWidths[columnKey]
    )
  );
}

function normalizeInterfaceTheme(theme: unknown, fallback: InterfaceTheme = 'system'): InterfaceTheme {
  return theme === 'system' || theme === 'light' || theme === 'dark' ? theme : fallback;
}

function normalizeRendererSettings(settings: Partial<AppSettings>, fallbackSettings = defaultSettings): AppSettings {
  return {
    ...fallbackSettings,
    ...settings,
    profiles: settings.profiles?.length ? settings.profiles : fallbackSettings.profiles,
    activeProfileId: settings.activeProfileId || fallbackSettings.activeProfileId,
    interfaceTheme: normalizeInterfaceTheme(settings.interfaceTheme, fallbackSettings.interfaceTheme),
    refreshIntervalSeconds: Number(settings.refreshIntervalSeconds) || fallbackSettings.refreshIntervalSeconds,
    torrentSort: settings.torrentSort ?? fallbackSettings.torrentSort,
    torrentColumnWidths: settings.torrentColumnWidths ?? fallbackSettings.torrentColumnWidths,
    recentDownloadDirs: settings.recentDownloadDirs ?? fallbackSettings.recentDownloadDirs
  };
}

export default function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [profile, setProfile] = useState<TransmissionProfile>(defaultProfile);
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState<TransmissionSession | null>(null);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<Torrent | null>(null);
  const [filter, setFilter] = useState<TorrentFilter>('all');
  const [sort, setSort] = useState<TorrentSortSettings>(defaultSettings.torrentSort);
  const [columnWidths, setColumnWidths] = useState<TorrentColumnWidths>(defaultSettings.torrentColumnWidths);
  const [query, setQuery] = useState('');
  const [detailTab, setDetailTab] = useState<DetailTab>('general');
  const [addOpen, setAddOpen] = useState(false);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusActivity, setStatusActivity] = useState<StatusActivity>('idle');
  const [message, setMessage] = useState('Ready');
  const settingsRef = useRef<AppSettings>(defaultSettings);
  const persistedSettingsRef = useRef<AppSettings>(defaultSettings);
  const sortRef = useRef<TorrentSortSettings>(defaultSettings.torrentSort);
  const columnWidthsRef = useRef<TorrentColumnWidths>(defaultSettings.torrentColumnWidths);
  const settingsSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const autoConnectStarted = useRef(false);
  const connectionRunId = useRef(0);

  const rpcVersion = Number(session?.['rpc-version'] ?? 16);

  const rpc = useCallback(<TArguments,>(method: string, args: Record<string, unknown> = {}) => {
    return transmissionApi().request<TArguments>({ method, arguments: args });
  }, []);

  const applySort = useCallback((nextSort: TorrentSortSettings): void => {
    sortRef.current = nextSort;
    setSort(nextSort);
  }, []);

  const applyColumnWidths = useCallback((nextColumnWidths: TorrentColumnWidths): void => {
    columnWidthsRef.current = nextColumnWidths;
    setColumnWidths(nextColumnWidths);
  }, []);

  const applySettings = useCallback((settingsUpdate: SettingsUpdate): AppSettings => {
    const nextSettings = typeof settingsUpdate === 'function' ? settingsUpdate(settingsRef.current) : settingsUpdate;
    if (nextSettings === settingsRef.current) {
      return nextSettings;
    }

    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    return nextSettings;
  }, []);

  const applyMirroredSettings = useCallback(
    (expectedSettings: AppSettings, nextSettings: AppSettings): void => {
      const shouldMirrorSort = sortRef.current === expectedSettings.torrentSort && !sameTorrentSort(sortRef.current, nextSettings.torrentSort);
      const shouldMirrorColumnWidths =
        columnWidthsRef.current === expectedSettings.torrentColumnWidths && !sameColumnWidths(columnWidthsRef.current, nextSettings.torrentColumnWidths);

      if (shouldMirrorSort) {
        applySort(nextSettings.torrentSort);
      }

      if (shouldMirrorColumnWidths) {
        applyColumnWidths(nextSettings.torrentColumnWidths);
      }
    },
    [applyColumnWidths, applySort]
  );

  const saveSettings = useCallback(async (nextSettings: AppSettings): Promise<AppSettings> => {
    const pendingSettings = applySettings(nextSettings);

    // Serialize writes so an older settings save cannot finish after a newer one and leave stale data on disk.
    const saveOperation = settingsSaveQueue.current.then(() => transmissionApi().saveSettings(pendingSettings));
    settingsSaveQueue.current = saveOperation.then(
      () => undefined,
      () => undefined
    );

    try {
      // A running main process from before a new setting was introduced may return a settings object without that key.
      const savedSettings = normalizeRendererSettings(await saveOperation, pendingSettings);
      persistedSettingsRef.current = savedSettings;

      // Settings writes can overlap; only apply the normalized response if this save is still the latest local settings object.
      if (settingsRef.current === pendingSettings) {
        const appliedSettings = applySettings(savedSettings);
        applyMirroredSettings(pendingSettings, appliedSettings);
        return appliedSettings;
      }

      return settingsRef.current;
    } catch (error) {
      if (settingsRef.current === pendingSettings) {
        const persistedSettings = persistedSettingsRef.current;
        applySettings(persistedSettings);
        applyMirroredSettings(pendingSettings, persistedSettings);
      }

      throw error;
    }
  }, [applyMirroredSettings, applySettings]);

  const refresh = useCallback(async (options: boolean | RefreshOptions = {}): Promise<void> => {
    const force = typeof options === 'boolean' ? options : Boolean(options.force);
    const showProgress = typeof options !== 'boolean' && Boolean(options.showProgress);
    const label = typeof options === 'boolean' ? 'Refresh' : options.label ?? 'Refresh';

    if (!force && !connected) {
      return;
    }

    try {
      if (showProgress) {
        setStatusActivity('requesting');
        setMessage(`${label}: sending request...`);
        await waitForProgressFrame();
      }

      const torrentRequest = rpc<TorrentGetResult>('torrent-get', { fields: torrentFields(rpcVersion) });
      const statsRequest = rpc<SessionStats>('session-stats');

      if (showProgress) {
        setStatusActivity('receiving');
        setMessage(`${label}: waiting for torrent data...`);
      }

      const [torrentResult, nextStats] = await Promise.all([torrentRequest, statsRequest]);

      setTorrents(torrentResult.torrents);
      setStats(nextStats);

      if (!selectedId && torrentResult.torrents.length > 0) {
        setSelectedId(torrentResult.torrents[0].id);
      } else if (selectedId && !torrentResult.torrents.some((torrent) => torrent.id === selectedId)) {
        setSelectedId(torrentResult.torrents[0]?.id ?? null);
      }

      if (showProgress) {
        setMessage(`Refreshed ${torrentResult.torrents.length} ${torrentResult.torrents.length === 1 ? 'torrent' : 'torrents'}`);
      }
    } finally {
      if (showProgress) {
        setStatusActivity('idle');
      }
    }
  }, [connected, rpc, rpcVersion, selectedId]);

  const loadDetails = useCallback(
    async (torrentId: number): Promise<void> => {
      const result = await rpc<TorrentGetResult>('torrent-get', {
        ids: [torrentId],
        fields: torrentDetailFields(rpcVersion)
      });
      setSelectedDetail(result.torrents[0] ?? null);
    },
    [rpc, rpcVersion]
  );

  useEffect(() => {
    let api: Window['transmission'];
    try {
      api = transmissionApi();
    } catch (error) {
      setMessage(errorMessage(error));
      return;
    }

    api
      .loadSettings()
      .then((loadedSettings) => {
        const normalizedSettings = normalizeRendererSettings(loadedSettings);
        const loadedProfile = normalizedSettings.profiles.find((savedProfile) => savedProfile.id === normalizedSettings.activeProfileId) ?? normalizedSettings.profiles[0];
        persistedSettingsRef.current = normalizedSettings;
        applySettings(normalizedSettings);
        applySort(normalizedSettings.torrentSort);
        applyColumnWidths(normalizedSettings.torrentColumnWidths);
        setProfile(loadedProfile);

        if (!autoConnectStarted.current) {
          autoConnectStarted.current = true;
          connectToProfile(loadedProfile).catch((error) => setMessage(errorMessage(error)));
        }
      })
      .catch((error) => setMessage(errorMessage(error)));
  }, [applyColumnWidths, applySettings, applySort]);

  useEffect(() => {
    if (!connected || !selectedId) {
      setSelectedDetail(null);
      return;
    }

    loadDetails(selectedId).catch((error) => setMessage(errorMessage(error)));
  }, [connected, loadDetails, selectedId]);

  useEffect(() => {
    if (!connected) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refresh().catch((error) => setMessage(errorMessage(error)));
      if (selectedId) {
        loadDetails(selectedId).catch((error) => setMessage(errorMessage(error)));
      }
    }, Math.max(2, settings.refreshIntervalSeconds) * 1000);

    return () => window.clearInterval(intervalId);
  }, [connected, loadDetails, refresh, selectedId, settings.refreshIntervalSeconds]);

  const filteredTorrents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return torrents
      .filter((torrent) => {
        const matchesText = !normalizedQuery || `${torrent.name} ${torrent.downloadDir} ${(torrent.labels ?? []).join(' ')}`.toLowerCase().includes(normalizedQuery);
        return matchesText && torrentMatchesFilter(torrent, filter);
      })
      .sort((firstTorrent, secondTorrent) => compareTorrents(firstTorrent, secondTorrent, sort));
  }, [filter, query, sort, torrents]);

  const selectedTorrent = useMemo(
    () => selectedDetail ?? torrents.find((torrent) => torrent.id === selectedId) ?? null,
    [selectedDetail, selectedId, torrents]
  );

  const counts = useMemo(() => countFilters(torrents), [torrents]);
  const effectiveInterfaceTheme = normalizeInterfaceTheme(settings.interfaceTheme);
  const sessionDefaultDownloadDir = String(session?.['download-dir'] ?? '');
  const defaultAddDownloadDir = useMemo(
    () => collectDownloadDirs([...(settings.recentDownloadDirs ?? []), sessionDefaultDownloadDir])[0] ?? '',
    [settings.recentDownloadDirs, sessionDefaultDownloadDir]
  );
  const downloadDirSuggestions = useMemo(
    () => {
      const downloadDirSources = downloadDirSuggestionSources(
        defaultAddDownloadDir,
        settings.recentDownloadDirs ?? [],
        torrents,
        sessionDefaultDownloadDir
      );
      return collectDownloadDirs(downloadDirSources);
    },
    [defaultAddDownloadDir, settings.recentDownloadDirs, sessionDefaultDownloadDir, torrents]
  );

  function changeSort(sortKey: TorrentSortKey): void {
    const nextSort: TorrentSortSettings = {
      key: sortKey,
      direction: sort.key === sortKey && sort.direction === 'asc' ? 'desc' : 'asc'
    };
    const nextSettings = { ...settingsRef.current, torrentSort: nextSort };

    applySort(nextSort);
    saveSettings(nextSettings).catch((error) => setMessage(errorMessage(error)));
  }

  function changeColumnWidth(sortKey: TorrentSortKey, width: number, commit: boolean): void {
    const nextColumnWidths = { ...columnWidthsRef.current, [sortKey]: Math.round(width) };
    applyColumnWidths(nextColumnWidths);

    if (!commit) {
      return;
    }

    const nextSettings = { ...settingsRef.current, torrentColumnWidths: nextColumnWidths };
    saveSettings(nextSettings).catch((error) => setMessage(errorMessage(error)));
  }

  async function selectProfile(profileId: string): Promise<void> {
    const savedProfile = settingsRef.current.profiles.find((candidate) => candidate.id === profileId);
    if (savedProfile) {
      setProfile(savedProfile);
      const nextSettings = { ...settingsRef.current, activeProfileId: profileId };
      await saveSettings(nextSettings);
      await switchToProfile(savedProfile);
    }
  }

  function clearConnectionData(): void {
    setConnected(false);
    setSession(null);
    setStats(null);
    setTorrents([]);
    setSelectedId(null);
    setSelectedDetail(null);
  }

  async function connectToProfile(targetProfile: TransmissionProfile): Promise<void> {
    const requestId = connectionRunId.current + 1;
    connectionRunId.current = requestId;
    setBusy(true);
    setMessage(`Connecting to ${targetProfile.name}...`);

    try {
      const nextProfile = ensureProfile(targetProfile);
      const result: ConnectionResult = await transmissionApi().connect(nextProfile);
      if (requestId !== connectionRunId.current) {
        return;
      }

      setConnected(result.connected);
      setProfile(result.profile);
      setSession(result.session);
      setStats(result.stats);
      const settingsForSave = settingsRef.current;
      await saveSettings({
        ...settingsForSave,
        activeProfileId: result.profile.id,
        profiles: [...settingsForSave.profiles.filter((savedProfile) => savedProfile.id !== result.profile.id), result.profile]
      });
      setMessage(`Connected to ${result.profile.name}`);
      await refresh(true);
    } catch (error) {
      if (requestId === connectionRunId.current) {
        clearConnectionData();
        setMessage(errorMessage(error));
      }
    } finally {
      if (requestId === connectionRunId.current) {
        setBusy(false);
      }
    }
  }

  async function switchToProfile(targetProfile: TransmissionProfile): Promise<void> {
    setMessage(`Switching to ${targetProfile.name}...`);
    if (connected) {
      await transmissionApi().disconnect();
      clearConnectionData();
    }

    await connectToProfile(targetProfile);
  }

  async function saveProfiles(profiles: TransmissionProfile[]): Promise<void> {
    const currentSettings = settingsRef.current;
    const normalizedProfiles = profiles.map(ensureProfile);
    const nextActiveProfileId = normalizedProfiles.some((savedProfile) => savedProfile.id === currentSettings.activeProfileId)
      ? currentSettings.activeProfileId
      : normalizedProfiles[0].id;
    const previousActiveProfile = currentSettings.profiles.find((savedProfile) => savedProfile.id === currentSettings.activeProfileId);
    const nextActiveProfile = normalizedProfiles.find((savedProfile) => savedProfile.id === nextActiveProfileId) ?? normalizedProfiles[0];
    const activeProfileChanged = JSON.stringify(previousActiveProfile) !== JSON.stringify(nextActiveProfile);

    await saveSettings({
      ...currentSettings,
      activeProfileId: nextActiveProfileId,
      profiles: normalizedProfiles
    });

    setProfile(nextActiveProfile);

    if (connected && activeProfileChanged) {
      await switchToProfile(nextActiveProfile);
      return;
    }

    setMessage('Connections saved');
  }

  async function saveAppSettings(interfaceTheme: InterfaceTheme): Promise<void> {
    await saveSettings({
      ...settingsRef.current,
      interfaceTheme
    });
    setMessage('App settings saved');
  }

  async function connect(): Promise<void> {
    await connectToProfile(profile);
  }

  async function refreshNow(): Promise<void> {
    setBusy(true);
    try {
      await refresh({ showProgress: true });
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(): Promise<void> {
    connectionRunId.current += 1;
    await transmissionApi().disconnect();
    clearConnectionData();
    setMessage('Disconnected');
  }

  function rememberDownloadDir(downloadDir?: string): void {
    const currentSettings = settingsRef.current;
    // Add completes after an RPC await, so merge against the latest settings ref instead of the render's older snapshot.
    const recentDownloadDirs = collectDownloadDirs([downloadDir, ...(currentSettings.recentDownloadDirs ?? [])]);
    if (sameDownloadDirs(recentDownloadDirs, currentSettings.recentDownloadDirs ?? [])) {
      return;
    }

    const nextSettings = { ...currentSettings, recentDownloadDirs };
    saveSettings(nextSettings)
      // The torrent has already been accepted at this point, so a settings-write failure should be reported without turning add into an error.
      .catch((error) => setMessage(`Torrent added, but saving recent folder failed: ${errorMessage(error)}`));
  }

  async function runTorrentAction(method: string, args: Record<string, unknown> = {}, reloadDetails = true): Promise<void> {
    if (!selectedId) {
      return;
    }

    setBusy(true);
    try {
      await rpc(method, { ids: [selectedId], ...args });
      await refresh();
      if (reloadDetails) {
        await loadDetails(selectedId);
      }
      setMessage('Updated');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeTorrent(): Promise<void> {
    if (!selectedId || !selectedTorrent) {
      return;
    }

    if (!window.confirm(`Remove "${selectedTorrent.name}" from Transmission?`)) {
      return;
    }

    await runTorrentAction('torrent-remove', { 'delete-local-data': false }, false);
    setSelectedId(null);
  }

  async function addTorrent(payload: AddTorrentPayload, reportProgress: AddTorrentProgress = () => undefined): Promise<void> {
    setBusy(true);
    setStatusActivity('requesting');
    setMessage('Add torrent: sending request...');
    reportProgress('Sending request to Transmission...');

    try {
      const addArguments: Record<string, unknown> = {
        paused: payload.paused
      };

      if (payload.filename) {
        addArguments.filename = payload.filename;
      }

      if (payload.metainfo) {
        addArguments.metainfo = payload.metainfo;
      }

      if (payload.downloadDir) {
        addArguments['download-dir'] = payload.downloadDir;
      }

      await waitForProgressFrame();
      const addRequest = rpc<TorrentAddResult>('torrent-add', addArguments);

      setStatusActivity('receiving');
      setMessage('Add torrent: waiting for response...');
      reportProgress('Waiting for Transmission response...');

      const addResult = await addRequest;
      const duplicateTorrent = addResult['torrent-duplicate'];
      const addedTorrent = addResult['torrent-added'];

      if (duplicateTorrent) {
        throw new Error(`Torrent already exists: ${duplicateTorrent.name || duplicateTorrent.hashString || 'same torrent'}`);
      }

      if (!addedTorrent) {
        throw new Error('Transmission accepted the request but did not report an added torrent.');
      }

      // When no folder is sent, Transmission applies the session default; remember that effective path instead of keeping an older custom default.
      rememberDownloadDir(payload.downloadDir || sessionDefaultDownloadDir || undefined);

      try {
        reportProgress('Refreshing torrent list...');
        await refresh({ force: true, showProgress: true, label: 'Refresh after add' });
        setMessage(`Added ${addedTorrent.name || 'torrent'}`);
      } catch (refreshError) {
        setMessage(`Torrent added, but refresh failed: ${errorMessage(refreshError)}`);
      }
    } catch (error) {
      setMessage(errorMessage(error));
      throw error;
    } finally {
      setStatusActivity('idle');
      setBusy(false);
    }
  }

  async function updateFileWanted(fileIndex: number, wanted: boolean): Promise<void> {
    if (!selectedId) {
      return;
    }

    await runTorrentAction('torrent-set', {
      [wanted ? 'files-wanted' : 'files-unwanted']: [fileIndex]
    });
  }

  async function updateFilePriority(fileIndex: number, priority: -1 | 0 | 1): Promise<void> {
    if (!selectedId) {
      return;
    }

    const priorityKey = priority > 0 ? 'priority-high' : priority < 0 ? 'priority-low' : 'priority-normal';
    await runTorrentAction('torrent-set', {
      [priorityKey]: [fileIndex]
    });
  }

  return (
    <div className="app-shell" data-theme={effectiveInterfaceTheme}>
      <ConnectionBar
        profile={profile}
        profiles={settings.profiles}
        connected={connected}
        busy={busy}
        onProfileSelect={selectProfile}
        onConnect={connect}
        onDisconnect={disconnect}
        onManageConnections={() => setConnectionsOpen(true)}
      />

      <Toolbar
        connected={connected}
        hasSelection={Boolean(selectedId)}
        busy={busy}
        onAdd={() => setAddOpen(true)}
        onRefresh={refreshNow}
        onStart={() => runTorrentAction('torrent-start')}
        onStop={() => runTorrentAction('torrent-stop')}
        onRemove={removeTorrent}
        onVerify={() => runTorrentAction('torrent-verify')}
        onReannounce={() => runTorrentAction('torrent-reannounce')}
        onOpenSettings={() => setAppSettingsOpen(true)}
      />

      <main className="main-layout">
        <FilterSidebar activeFilter={filter} counts={counts} onFilterChange={setFilter} />
        <section className="workspace" aria-label="Torrents">
          <div className="list-header">
            <h1>Torrents</h1>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search torrents" />
          </div>
          {!connected ? (
            <div className="connection-empty">
              <h2>Disconnected</h2>
              <p>Choose a saved connection or open Connections to edit daemon details.</p>
            </div>
          ) : (
            <TorrentTable
              torrents={filteredTorrents}
              selectedId={selectedId}
              sort={sort}
              columnWidths={columnWidths}
              onSelect={setSelectedId}
              onSortChange={changeSort}
              onColumnResize={changeColumnWidth}
            />
          )}
          <DetailPane
            torrent={selectedTorrent}
            session={session}
            stats={stats}
            activeTab={detailTab}
            busy={busy}
            onTabChange={setDetailTab}
            onFileWantedChange={updateFileWanted}
            onFilePriorityChange={updateFilePriority}
          />
        </section>
      </main>

      <StatusBar
        connected={connected}
        profile={profile}
        stats={stats}
        selectedTorrent={selectedTorrent}
        message={message}
        activity={statusActivity}
      />
      <ConnectionSettingsDialog
        open={connectionsOpen}
        profiles={settings.profiles}
        activeProfileId={settings.activeProfileId}
        busy={busy}
        onClose={() => setConnectionsOpen(false)}
        onSave={saveProfiles}
      />
      <AppSettingsDialog
        open={appSettingsOpen}
        interfaceTheme={effectiveInterfaceTheme}
        busy={busy}
        onClose={() => setAppSettingsOpen(false)}
        onSave={saveAppSettings}
      />
      <AddTorrentDialog
        open={addOpen}
        busy={busy}
        defaultDownloadDir={defaultAddDownloadDir}
        downloadDirSuggestions={downloadDirSuggestions}
        onClose={() => setAddOpen(false)}
        onSubmit={addTorrent}
      />
    </div>
  );
}
