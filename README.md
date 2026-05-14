# Transmission Electron GUI

A modern Electron + React + TypeScript desktop client for connecting to a Transmission daemon over the Transmission RPC API.

This project is a fresh implementation inspired by the workflows of Transmission Remote GUI: connection profiles, torrent list filters, toolbar actions, add-torrent flow, sortable/resizable torrent columns, and detail panes for general info, files, peers, trackers, and statistics.

The original Pascal/Lazarus Transmission Remote GUI project was used as workflow reference only. This repository does not copy its source files or assets.

## Features

- Cross-platform desktop shell built with Electron and Vite.
- React + TypeScript renderer with a dense desktop-style Transmission UI.
- Secure Electron main/preload split with `contextIsolation` enabled.
- Saved connection profiles with automatic reconnect on startup and profile switch.
- Transmission RPC client with `X-Transmission-Session-Id` retry handling.
- Basic authentication support for RPC connections.
- Connection profile passwords encrypted at rest with Electron `safeStorage` when OS encryption is available.
- Torrent grid with filters, search, progress, rates, ratio, ETA, peer count, sortable columns, and persisted column widths.
- Toolbar actions for add, start, stop, remove, verify, reannounce, and refresh.
- Add torrent dialog for magnet links, URLs, bare info hashes, and local `.torrent` files.
- Detail tabs for general information, file wanted/priority controls, peers, trackers, stats, and configured direct download links.
- App settings for interface theme and torrent list size-unit display.

## Prerequisites

- Node.js 22 or newer.
- npm, which is bundled with Node.js.
- Git for cloning and release tagging.

## Local Setup

Install dependencies:

```bash
npm install
```

On Windows PowerShell, if script execution policy blocks the `npm.ps1` shim, call `npm.cmd` instead:

```powershell
npm.cmd install
```

The optional helper scripts in this repository are Windows convenience wrappers for a local portable-tooling setup. They prepend these folders to `PATH` before invoking npm:

- Git: `%LOCALAPPDATA%\Programs\MinGit`
- Node.js: `%LOCALAPPDATA%\Programs\nodejs`

## Development

Run the Electron/Vite development app:

```bash
npm run dev
```

Build and type-check the app:

```bash
npm run build
```

Preview the production build:

```bash
npm run start
```

On the Windows portable-tooling setup described above, the wrapper scripts provide the same development and build commands:

```powershell
.\dev.cmd
.\build.cmd
```

## Build

```bash
npm run build
```

## Packages

Build a Windows x64 installer with Electron Builder:

```powershell
npm.cmd run dist:win
```

The installer is written to `release/` and is intended to be published as a GitHub Release asset. The current installer is unsigned, so Windows may show an unknown-publisher warning.

Build unsigned macOS packages on macOS:

```bash
npm run dist:mac
```

This writes `.dmg` and `.zip` packages for Intel and Apple Silicon Macs to `release/`. Without Apple Developer ID signing and notarization, macOS Gatekeeper may warn before opening the app.

Build Ubuntu/Linux packages on Linux:

```bash
npm run dist:linux
```

This writes an x64 `.AppImage` and `.deb` package to `release/`.

The supported release path builds Windows packages on Windows, macOS packages on macOS, and Linux packages on Linux.

## Releases

GitHub Actions builds Windows, macOS, and Ubuntu packages from `.github/workflows/release.yml`. Manual workflow runs upload build artifacts, and pushing a tag like `vX.Y.Z` publishes those artifacts to the matching GitHub Release.

## Notes

Passwords entered into profiles are encrypted before being written to the local Electron settings JSON when Electron `safeStorage` can use the OS encryption backend. If that backend is unavailable, the app preserves profile usability by falling back to plaintext storage and logging a warning.

No license has been selected yet.