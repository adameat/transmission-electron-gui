# Copilot Instructions

This repository is an Electron + Vite + React + TypeScript desktop client for Transmission daemon RPC.

- Keep the Electron main/preload split secure; do not enable renderer Node integration.
- Use the typed IPC surface exposed through `window.transmission` for renderer-to-main communication.
- Keep Transmission RPC request/response types in `src/shared/types.ts`.
- Prefer focused, dense desktop UI patterns over marketing-style layouts.
- Run `npm.cmd run build` or `./build.cmd` on Windows before publishing changes.
- Do not commit generated build output, `node_modules`, local secrets, or Electron user data.
