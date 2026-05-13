// The Add Torrent picker is scrollable, so keep a useful history without letting settings grow without bound.
export const maxRecentDownloadDirs = 32;
// Current torrents are only a fallback source for suggestions, so cap the scan to keep refresh-driven renders bounded on huge libraries.
export const maxTorrentDownloadDirSuggestionScan = 500;

export function collectDownloadDirs(downloadDirs: Iterable<unknown>, maxDownloadDirs = maxRecentDownloadDirs): string[] {
  const seenDownloadDirs = new Set<string>();
  const collectedDownloadDirs: string[] = [];

  for (const downloadDir of downloadDirs) {
    if (typeof downloadDir !== 'string') {
      continue;
    }

    // Transmission paths may belong to a remote daemon, so preserve separators and casing instead of normalizing with the local OS.
    const trimmedDownloadDir = downloadDir.trim();
    if (!trimmedDownloadDir || seenDownloadDirs.has(trimmedDownloadDir)) {
      continue;
    }

    seenDownloadDirs.add(trimmedDownloadDir);
    collectedDownloadDirs.push(trimmedDownloadDir);

    if (collectedDownloadDirs.length >= maxDownloadDirs) {
      break;
    }
  }

  return collectedDownloadDirs;
}

export function normalizeDownloadDirs(downloadDirs: unknown): string[] {
  if (!Array.isArray(downloadDirs)) {
    return [];
  }

  return collectDownloadDirs(downloadDirs);
}