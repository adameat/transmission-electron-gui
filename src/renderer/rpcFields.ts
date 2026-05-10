const BASE_TORRENT_FIELDS = [
  'id',
  'name',
  'status',
  'error',
  'errorString',
  'percentDone',
  'metadataPercentComplete',
  'sizeWhenDone',
  'totalSize',
  'leftUntilDone',
  'rateDownload',
  'rateUpload',
  'uploadRatio',
  'uploadedEver',
  'downloadedEver',
  'eta',
  'peersConnected',
  'peersGettingFromUs',
  'peersSendingToUs',
  'seeders',
  'leechers',
  'queuePosition',
  'addedDate',
  'doneDate',
  'activityDate',
  'downloadDir',
  'isPrivate',
  'trackerStats'
];

const DETAIL_FIELDS = [
  ...BASE_TORRENT_FIELDS,
  'comment',
  'creator',
  'dateCreated',
  'files',
  'fileStats',
  'hashString',
  'peers',
  'pieceCount',
  'pieceSize',
  'priorities',
  'recheckProgress',
  'secondsDownloading',
  'secondsSeeding',
  'trackers',
  'wanted'
];

export function torrentFields(rpcVersion = 16): string[] {
  return rpcVersion >= 16 ? [...BASE_TORRENT_FIELDS, 'labels'] : [...BASE_TORRENT_FIELDS];
}

export function torrentDetailFields(rpcVersion = 16): string[] {
  const fields = rpcVersion >= 16 ? [...DETAIL_FIELDS, 'labels'] : [...DETAIL_FIELDS];
  return Array.from(new Set(fields));
}
