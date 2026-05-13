import { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeDownloadDirs } from '../src/shared/downloadDirs';
import type {
  AppSettings,
  ConnectionResult,
  OpenedTorrentFile,
  RpcEnvelope,
  RpcRequest,
  SessionStats,
  TransmissionProfile,
  TransmissionSession
} from '../src/shared/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hidesWindowMenuBar = process.platform !== 'darwin';

let mainWindow: BrowserWindow | null = null;
let activeProfile: TransmissionProfile | null = null;
let sessionId: string | null = null;

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

const torrentColumnKeys = new Set(['name', 'size', 'done', 'status', 'down', 'up', 'eta', 'ratio', 'peers', 'added']);

type StoredTransmissionProfile = Omit<TransmissionProfile, 'password'> & {
  password?: string;
  encryptedPassword?: string;
};

type StoredAppSettings = Omit<AppSettings, 'profiles'> & {
  profiles: StoredTransmissionProfile[];
};

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function decryptStoredPassword(profile: Partial<StoredTransmissionProfile>): string {
  if (!profile.encryptedPassword) {
    return profile.password || '';
  }

  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('Profile password could not be decrypted because OS password encryption is unavailable.');
    return profile.password || '';
  }

  try {
    return safeStorage.decryptString(Buffer.from(profile.encryptedPassword, 'base64'));
  } catch (error) {
    console.warn('Unable to decrypt stored profile password:', error);
    return profile.password || '';
  }
}

function encryptStoredPassword(password: string): Pick<StoredTransmissionProfile, 'password' | 'encryptedPassword'> {
  if (!password) {
    return {};
  }

  if (safeStorage.isEncryptionAvailable()) {
    try {
      return { encryptedPassword: safeStorage.encryptString(password).toString('base64') };
    } catch (error) {
      console.warn('Unable to encrypt profile password:', error);
    }
  }

  console.warn('OS password encryption is unavailable; storing profile password in plaintext.');
  return { password };
}

function normalizeProfile(profile: Partial<StoredTransmissionProfile>): TransmissionProfile {
  return {
    id: profile.id || randomUUID(),
    name: profile.name?.trim() || 'Transmission daemon',
    protocol: profile.protocol === 'https' ? 'https' : 'http',
    host: profile.host?.trim() || '127.0.0.1',
    port: Number(profile.port) || 9091,
    rpcPath: profile.rpcPath?.startsWith('/') ? profile.rpcPath : `/${profile.rpcPath || 'transmission/rpc'}`,
    username: profile.username || '',
    password: decryptStoredPassword(profile)
  };
}

function normalizeInterfaceTheme(theme: unknown): AppSettings['interfaceTheme'] {
  return theme === 'light' || theme === 'dark' ? theme : 'system';
}

function normalizeSizeUnitLimit(sizeUnitLimit: unknown): AppSettings['sizeUnitLimit'] {
  return sizeUnitLimit === 'auto' || sizeUnitLimit === 'bytes' || sizeUnitLimit === 'megabytes' || sizeUnitLimit === 'gigabytes'
    ? sizeUnitLimit
    : 'auto';
}

function normalizeSettings(settings: Partial<StoredAppSettings>): AppSettings {
  const profiles = settings.profiles?.length
    ? settings.profiles.map((profile) => normalizeProfile(profile))
    : [defaultProfile];
  const savedColumnWidths = settings.torrentColumnWidths ?? {};
  const torrentColumnWidths = Object.entries(savedColumnWidths).reduce<Record<string, number>>((widths, [key, value]) => {
    const width = Number(value);
    if (torrentColumnKeys.has(key) && Number.isFinite(width)) {
      widths[key] = Math.max(48, Math.min(1200, Math.round(width)));
    }

    return widths;
  }, {});

  return {
    profiles,
    activeProfileId: settings.activeProfileId || profiles[0].id,
    interfaceTheme: normalizeInterfaceTheme(settings.interfaceTheme),
    sizeUnitLimit: normalizeSizeUnitLimit(settings.sizeUnitLimit),
    refreshIntervalSeconds: Number(settings.refreshIntervalSeconds) || 5,
    torrentSort: {
      key: settings.torrentSort?.key || 'name',
      direction: settings.torrentSort?.direction === 'desc' ? 'desc' : 'asc'
    },
    torrentColumnWidths,
    recentDownloadDirs: normalizeDownloadDirs(settings.recentDownloadDirs)
  };
}

function serializeProfile(profile: TransmissionProfile): StoredTransmissionProfile {
  const normalizedProfile = normalizeProfile(profile);
  const { password, ...profileWithoutPassword } = normalizedProfile;
  return {
    ...profileWithoutPassword,
    ...encryptStoredPassword(password)
  };
}

function serializeSettings(settings: AppSettings): StoredAppSettings {
  const normalizedSettings = normalizeSettings(settings);
  return {
    ...normalizedSettings,
    profiles: normalizedSettings.profiles.map((profile) => serializeProfile(profile))
  };
}

function hasPlaintextPasswords(settings: Partial<StoredAppSettings>): boolean {
  return Boolean(settings.profiles?.some((profile) => profile.password));
}

async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf8');
    const storedSettings = JSON.parse(raw) as Partial<StoredAppSettings>;
    const settings = normalizeSettings(storedSettings);

    if (hasPlaintextPasswords(storedSettings) && safeStorage.isEncryptionAvailable()) {
      try {
        await writeSettings(settings);
      } catch (migrationError) {
        console.warn('Unable to migrate plaintext profile passwords:', migrationError);
      }
    }

    return settings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('Unable to read settings:', error);
    }

    return normalizeSettings({ profiles: [defaultProfile] });
  }
}

async function writeSettings(settings: AppSettings): Promise<AppSettings> {
  const nextSettings = normalizeSettings(settings);
  const storedSettings = serializeSettings(nextSettings);
  await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
  await fs.writeFile(settingsPath(), `${JSON.stringify(storedSettings, null, 2)}\n`, 'utf8');
  return nextSettings;
}

function buildRpcUrl(profile: TransmissionProfile): string {
  const rpcPath = profile.rpcPath.startsWith('/') ? profile.rpcPath : `/${profile.rpcPath}`;
  return `${profile.protocol}://${profile.host}:${profile.port}${rpcPath}`;
}

function resolvePreloadPath(): string {
  const candidates = [path.join(__dirname, '../preload/index.mjs'), path.join(__dirname, '../preload/index.js')];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function buildHeaders(profile: TransmissionProfile): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  if (sessionId) {
    headers['X-Transmission-Session-Id'] = sessionId;
  }

  if (profile.username) {
    const token = Buffer.from(`${profile.username}:${profile.password || ''}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  return headers;
}

async function sendRpc<TArguments = Record<string, unknown>>(
  request: RpcRequest,
  profile = activeProfile,
  retryOnSessionId = true
): Promise<TArguments> {
  if (!profile) {
    throw new Error('No Transmission connection profile is active.');
  }

  const response = await fetch(buildRpcUrl(profile), {
    method: 'POST',
    headers: buildHeaders(profile),
    body: JSON.stringify({ method: request.method, arguments: request.arguments ?? {}, tag: request.tag })
  });

  if (response.status === 409 && retryOnSessionId) {
    const nextSessionId = response.headers.get('x-transmission-session-id');
    if (!nextSessionId) {
      throw new Error('Transmission requested a session id but did not return one.');
    }

    sessionId = nextSessionId;
    return sendRpc<TArguments>(request, profile, false);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Transmission RPC ${response.status}: ${body || response.statusText}`);
  }

  const envelope = (await response.json()) as RpcEnvelope<TArguments>;
  if (envelope.result !== 'success') {
    throw new Error(envelope.result || 'Transmission RPC request failed.');
  }

  return envelope.arguments;
}

async function connect(profile: TransmissionProfile): Promise<ConnectionResult> {
  activeProfile = normalizeProfile(profile);
  sessionId = null;

  const [session, stats] = await Promise.all([
    sendRpc<TransmissionSession>({ method: 'session-get' }, activeProfile),
    sendRpc<SessionStats>({ method: 'session-stats' }, activeProfile)
  ]);

  return {
    connected: true,
    profile: activeProfile,
    session,
    stats
  };
}

async function openTorrentFile(): Promise<OpenedTorrentFile | null> {
  if (!mainWindow) {
    return null;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select torrent file',
    properties: ['openFile'],
    filters: [
      { name: 'Torrent files', extensions: ['torrent'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const buffer = await fs.readFile(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    metainfo: buffer.toString('base64')
  };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: 'Transmission Electron GUI',
    backgroundColor: '#f4f4f1',
    autoHideMenuBar: hidesWindowMenuBar,
    show: false,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (hidesWindowMenuBar) {
    mainWindow.setMenuBarVisibility(false);
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch((error) => console.warn('Unable to open external URL:', error));
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function configureApplicationMenu(): void {
  if (process.platform === 'darwin') {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    return;
  }

  Menu.setApplicationMenu(null);
}

function registerIpc(): void {
  ipcMain.handle('settings:load', () => readSettings());
  ipcMain.handle('settings:save', (_event, settings: AppSettings) => writeSettings(settings));
  ipcMain.handle('rpc:connect', (_event, profile: TransmissionProfile) => connect(profile));
  ipcMain.handle('rpc:disconnect', () => {
    activeProfile = null;
    sessionId = null;
    return true;
  });
  ipcMain.handle('rpc:request', (_event, request: RpcRequest) => sendRpc(request));
  ipcMain.handle('dialog:openTorrentFile', () => openTorrentFile());
}

app.whenReady().then(() => {
  registerIpc();
  configureApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
