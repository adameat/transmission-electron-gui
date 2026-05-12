export type RpcProtocol = 'http' | 'https';

export interface TransmissionProfile {
  id: string;
  name: string;
  protocol: RpcProtocol;
  host: string;
  port: number;
  rpcPath: string;
  username: string;
  password: string;
}

export interface AppSettings {
  profiles: TransmissionProfile[];
  activeProfileId: string;
  refreshIntervalSeconds: number;
  torrentSort: TorrentSortSettings;
  torrentColumnWidths: TorrentColumnWidths;
}

export type SortDirection = 'asc' | 'desc';

export type TorrentSortKey = 'name' | 'size' | 'done' | 'status' | 'down' | 'up' | 'eta' | 'ratio' | 'peers' | 'added';

export type TorrentColumnWidths = Partial<Record<TorrentSortKey, number>>;

export interface TorrentSortSettings {
  key: TorrentSortKey;
  direction: SortDirection;
}

export interface RpcRequest {
  method: string;
  arguments?: Record<string, unknown>;
  tag?: number;
}

export interface RpcEnvelope<TArguments = Record<string, unknown>> {
  result: string;
  arguments: TArguments;
  tag?: number;
}

export interface ConnectionResult {
  connected: true;
  profile: TransmissionProfile;
  session: TransmissionSession;
  stats: SessionStats;
}

export interface OpenedTorrentFile {
  path: string;
  name: string;
  metainfo: string;
}

export interface TransmissionSession {
  version?: string;
  'rpc-version'?: number;
  'download-dir'?: string;
  'speed-limit-down'?: number;
  'speed-limit-down-enabled'?: boolean;
  'speed-limit-up'?: number;
  'speed-limit-up-enabled'?: boolean;
  'alt-speed-enabled'?: boolean;
  'dht-enabled'?: boolean;
  'pex-enabled'?: boolean;
  'lpd-enabled'?: boolean;
  encryption?: string;
  [key: string]: unknown;
}

export interface SessionStats {
  activeTorrentCount: number;
  downloadSpeed: number;
  pausedTorrentCount: number;
  torrentCount: number;
  uploadSpeed: number;
  cumulativeStats?: TransferStats;
  currentStats?: TransferStats;
  [key: string]: unknown;
}

export interface TransferStats {
  uploadedBytes: number;
  downloadedBytes: number;
  filesAdded: number;
  sessionCount: number;
  secondsActive: number;
}

export interface Torrent {
  id: number;
  name: string;
  status: number;
  error: number;
  errorString: string;
  percentDone: number;
  metadataPercentComplete?: number;
  sizeWhenDone: number;
  totalSize: number;
  leftUntilDone: number;
  rateDownload: number;
  rateUpload: number;
  uploadRatio: number;
  uploadedEver: number;
  downloadedEver: number;
  eta: number;
  peersConnected: number;
  peersGettingFromUs: number;
  peersSendingToUs: number;
  seeders?: number;
  leechers?: number;
  queuePosition: number;
  addedDate: number;
  doneDate: number;
  activityDate: number;
  downloadDir: string;
  isPrivate?: boolean;
  labels?: string[];
  trackerStats?: TrackerStat[];
  files?: TorrentFile[];
  fileStats?: TorrentFileStat[];
  peers?: Peer[];
  trackers?: Tracker[];
  comment?: string;
  creator?: string;
  dateCreated?: number;
  hashString?: string;
  pieceCount?: number;
  pieceSize?: number;
  recheckProgress?: number;
  secondsDownloading?: number;
  secondsSeeding?: number;
  [key: string]: unknown;
}

export interface TorrentFile {
  name: string;
  length: number;
  bytesCompleted: number;
}

export interface TorrentFileStat {
  bytesCompleted: number;
  wanted: boolean;
  priority: -1 | 0 | 1;
}

export interface Peer {
  address: string;
  port: number;
  clientName: string;
  flagStr?: string;
  progress: number;
  rateToClient: number;
  rateToPeer: number;
  isEncrypted?: boolean;
  isIncoming?: boolean;
}

export interface Tracker {
  id: number;
  announce: string;
  scrape?: string;
  tier?: number;
}

export interface TrackerStat {
  id: number;
  host: string;
  announce: string;
  lastAnnounceResult: string;
  lastAnnounceSucceeded: boolean;
  lastAnnounceTime: number;
  nextAnnounceTime: number;
  seederCount: number;
  leecherCount: number;
  downloadCount: number;
  hasAnnounced: boolean;
  hasScraped: boolean;
}

export interface TorrentGetResult {
  torrents: Torrent[];
  removed?: number[];
}

export interface TorrentAddEntry {
  id?: number;
  name?: string;
  hashString?: string;
}

export interface TorrentAddResult {
  'torrent-added'?: TorrentAddEntry;
  'torrent-duplicate'?: TorrentAddEntry;
}

export type TorrentFilter =
  | 'all'
  | 'downloading'
  | 'completed'
  | 'active'
  | 'inactive'
  | 'stopped'
  | 'error'
  | 'waiting';
