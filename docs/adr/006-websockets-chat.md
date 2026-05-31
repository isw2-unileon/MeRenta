# ADR-006: Use of WebSockets for Chat

## Status

Accepted

## Date

2026-05-25

## Context

We need a chat experience that updates in real time and feels responsive. Users expect messages to appear instantly without manual refresh, which improves usability and engagement.

## Decision

Use WebSockets to power the chat, enabling full real-time messaging.

## Consequences

- Real-time message delivery provides a complete chat experience.
- The interaction is more convenient and fluid for users.
- Requires maintaining persistent connections and handling connection lifecycle.

