# Agent Instructions

This repository is an Electron + Vite + React + TypeScript desktop client for Transmission daemon RPC.

## Commenting Expectations

- When changing source code, err on the side of leaving explanatory comments for non-obvious behavior, questionable tradeoffs, platform-specific decisions, security-sensitive code, async/race handling, data migrations, fallback behavior, and UI layout constraints.
- If a change could reasonably make a reviewer ask "why is it done this way?", add a nearby source comment explaining the reason.
- Comments should explain intent, constraints, or risk. Avoid comments that merely restate obvious code mechanics.
- When preserving behavior because of compatibility, OS conventions, Transmission RPC quirks, or prior review feedback, document that context in the source near the relevant code.

## Project Constraints

- Keep the Electron main/preload split secure; do not enable renderer Node integration.
- Use the typed IPC surface exposed through `window.transmission` for renderer-to-main communication.
- Keep Transmission RPC request/response types in `src/shared/types.ts`.
- Prefer focused, dense desktop UI patterns over marketing-style layouts.
- Run `npm.cmd run build` or `./build.cmd` on Windows before publishing changes.
- Do not commit generated build output, `node_modules`, local secrets, or Electron user data.
