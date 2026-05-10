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
- Torrent grid with filters, search, progress, rates, ratio, ETA, peer count, sortable columns, and persisted column widths.
- Toolbar actions for add, start, stop, remove, verify, reannounce, and refresh.
- Add torrent dialog for magnet links, URLs, bare info hashes, and local `.torrent` files.
- Detail tabs for general information, file wanted/priority controls, peers, trackers, and stats.

## Local Setup

Install dependencies:

```powershell
npm install
```

On the current development machine, Git and Node.js were installed locally without admin privileges:

- Git: `%LOCALAPPDATA%\Programs\MinGit`
- Node.js: `%LOCALAPPDATA%\Programs\nodejs`

In PowerShell on that machine, use `npm.cmd` instead of `npm` because script execution policy blocks the `npm.ps1` shim.

## Development

The helper scripts prepend the local Node.js and MinGit folders to `PATH` before invoking npm:

```powershell
.\dev.cmd
.\build.cmd
```

You can also run npm directly after opening a terminal with Node.js on `PATH`:

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run build
npm.cmd run start
```

## Build

```powershell
npm.cmd run build
```

## Notes

Passwords entered into profiles are stored in the local Electron settings JSON for this first version. Before sharing or packaging the app, move secrets into the OS credential store.

No license has been selected yet.