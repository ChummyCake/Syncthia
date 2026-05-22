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
pnpm dev:api
pnpm dev:mobile
pnpm test
pnpm typecheck
```

The API currently uses an in-memory session repository for fast MVP iteration. The Prisma schema in `apps/api/prisma/schema.prisma` defines the Postgres persistence target for the next step.

## Provider Scope

- Messenger: launch/link-out for simple personal calls.
- Discord: launch/link-out for streaming, gaming, and group/server contexts.
- Zalo: launch/link-out for Vietnam/Zalo-first contacts.

No private provider APIs, scraping, media interception, or automatic third-party call control are used.
