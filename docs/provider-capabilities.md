# Provider Capabilities

Syncthia treats Messenger, Discord, and Zalo as external calling providers. It coordinates handoff but does not intercept or control provider media.

## Messenger

- MVP support: open Messenger web/app links and guide users into the agreed chat or call.
- Recommended for: simple personal calls and long calls.
- Constraint: public Messenger Platform APIs are centered on Page messaging and do not provide consumer call control for third-party apps.

## Discord

- MVP support: open Discord links, DMs, channels, or invite URLs supplied by users.
- Recommended for: streaming, gaming, and group/server contexts.
- Later support: Discord OAuth and server/bot-assisted invite creation where the user grants appropriate permissions.

## Zalo

- MVP support: open Zalo links for Zalo-first or Vietnam-centric contacts.
- Recommended for: contacts who prefer Zalo.
- Constraint: deeper calling integration is primarily Zalo OA/ZCC business/SIP-trunk oriented and should be planned as a separate product track.

## Manual Verification Checklist

- iOS: launch Messenger, Discord, and Zalo links when each app is installed.
- iOS: verify graceful web fallback when a provider app is not installed.
- Android: launch Messenger, Discord, and Zalo links when each app is installed.
- Android: verify graceful web fallback when a provider app is not installed.
- Both platforms: verify returning to Syncthia and tapping `I joined` updates the session provider only after both participants confirm.
