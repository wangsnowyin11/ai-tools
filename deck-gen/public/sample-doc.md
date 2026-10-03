# Tech Design: Realtime Notification Service (RNS)

Author: Platform Messaging Team · Status: In review · Oct 2026

## Background
Today, each product team sends in-app notifications by polling its own database every 30s from the client. This causes ~40k QPS of wasted polling traffic, notification delays of up to 30s, and duplicated logic across 6 teams.

## Goals
- Deliver notifications to online clients in < 1s p99.
- One shared service and SDK for all product teams.
- Cut polling traffic by > 90%.
- Guarantee at-least-once delivery; clients dedupe by notification ID.

## Non-goals
- Email / push notification delivery (handled by existing Outbound service).
- Rich notification templating (phase 2).

## Proposed design
Producers (product services) publish notification events to a Kafka topic `notifications.v1` through a thin Publish API that validates schema and enforces per-producer rate limits.

A Fanout worker pool consumes from Kafka, looks up the recipient's active connections in a Redis-backed Presence store, and forwards the event to the right Gateway node.

Gateway nodes hold long-lived WebSocket connections with clients (~200k connections per node). On connect, a client authenticates with its session token, and the gateway registers (user_id → gateway_node) in Presence with a 60s TTL refreshed by heartbeats.

If the user is offline, the event is written to an Inbox table (Cassandra, 30-day TTL). On reconnect, the client calls `GET /inbox?since=<cursor>` to catch up, then switches to the live stream.

### Delivery flow
1. Product service calls Publish API.
2. Publish API validates and writes to Kafka (partitioned by user_id for ordering).
3. Fanout worker reads the event, writes it to Inbox, and looks up Presence.
4. If online, Fanout sends it to the owning Gateway node over internal gRPC.
5. Gateway pushes it over WebSocket; client ACKs; unACKed messages are retried 3x and stay in Inbox.

## Alternatives considered
- **Keep polling with longer intervals**: cheap, but delays get worse and doesn't fix duplication.
- **Server-Sent Events instead of WebSocket**: simpler, but no client ACK channel and worse mobile support.
- **Managed pub/sub vendor**: fast to start, but cost at our scale is ~3x and data residency concerns.

## Scale & capacity
- Peak 8M concurrent connections → ~40 gateway nodes plus 25% headroom.
- 50k notifications/sec peak publish rate.
- Redis Presence: ~8M keys, ~1.2 GB.

## Risks
- Reconnect storms after a gateway deploy → mitigate with jittered reconnect and connection draining.
- Hot partitions for very high-fanout users → cap fanout per event; use a separate broadcast path for announcements.
- Presence staleness causing missed live delivery → Inbox catch-up guarantees eventual delivery.

## Rollout
- M1 (Nov): Gateway + Presence in staging, internal dogfood.
- M2 (Dec): Migrate 2 pilot teams behind a feature flag; 5% traffic.
- M3 (Q1): All 6 teams migrated; deprecate client polling.

## Open questions
- Do we need per-team quotas at launch, or only global rate limits?
- Who owns the client SDK long term: Platform or each client team?
