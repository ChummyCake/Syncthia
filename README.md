# Syncthia

Syncthia is a mobile call companion for coordinated provider handoff across exactly three selectable apps: Messenger, Discord, and Zalo.

The app does not proxy or control third-party audio/video. It keeps call session state, recommends a provider, asks both participants to accept a provider switch, launches the selected provider through safe links, and records manual join confirmation.

## Workspace

- `apps/mobile`: Expo + React Native mobile app.
- `apps/api`: NestJS API and WebSocket gateway.
- `packages/shared`: provider enum, recommendation engine, launch adapters, and switch state machine shared by mobile and API.

## Commands

```bash
pnpm install
docker compose up -d
pnpm --filter @syncthia/api prisma:generate
pnpm --filter @syncthia/api prisma:migrate
pnpm dev:api
pnpm dev:mobile
pnpm test
pnpm typecheck
```

The API uses Prisma/Postgres for persisted sessions, switch proposals, join confirmations, provider endpoints, devices, and audit records. Unit tests use an in-memory session repository so they do not require a running database.

## Provider Scope

- Messenger: launch/link-out for simple personal calls.
- Discord: launch/link-out for streaming, gaming, and group/server contexts.
- Zalo: launch/link-out for Vietnam/Zalo-first contacts.

No private provider APIs, scraping, media interception, or automatic third-party call control are used.
