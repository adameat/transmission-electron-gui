import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, ConnectionResult, OpenedTorrentFile, RpcRequest, TransmissionProfile } from '../src/shared/types';

const api = {
  loadSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: AppSettings): Promise<AppSettings> => ipcRenderer.invoke('settings:save', settings),
  connect: (profile: TransmissionProfile): Promise<ConnectionResult> => ipcRenderer.invoke('rpc:connect', profile),
  disconnect: (): Promise<boolean> => ipcRenderer.invoke('rpc:disconnect'),
  request: <TArguments = Record<string, unknown>>(request: RpcRequest): Promise<TArguments> => ipcRenderer.invoke('rpc:request', request),
  openTorrentFile: (): Promise<OpenedTorrentFile | null> => ipcRenderer.invoke('dialog:openTorrentFile'),
  deleteOpenedTorrentFile: (filePath: string): Promise<boolean> => ipcRenderer.invoke('file:deleteOpenedTorrentFile', filePath)
};

contextBridge.exposeInMainWorld('transmission', api);
