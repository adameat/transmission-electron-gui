/// <reference types="vite/client" />

import type { AppSettings, ConnectionResult, OpenedTorrentFile, RpcRequest, TransmissionProfile } from './shared/types';

declare global {
  interface Window {
    transmission: {
      loadSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<AppSettings>;
      connect: (profile: TransmissionProfile) => Promise<ConnectionResult>;
      disconnect: () => Promise<boolean>;
      request: <TArguments = Record<string, unknown>>(request: RpcRequest) => Promise<TArguments>;
      openTorrentFile: () => Promise<OpenedTorrentFile | null>;
      deleteOpenedTorrentFile: (filePath: string) => Promise<boolean>;
    };
  }
}

export {};