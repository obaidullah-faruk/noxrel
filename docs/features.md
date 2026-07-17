# Noxrel — Platform Features

Feature inventory for the cloud-native, event-driven video streaming platform.

**Status legend**

| Status | Meaning |
|---|---|
| Done | Implemented and in active use |
| In progress | Code present; still being hardened or extended |
| Remaining | Not yet built |

---

## Contents

1. [Auth & Users](#1-auth--users)
2. [Video Upload & Catalog](#2-video-upload--catalog)
3. [Transcoding](#3-transcoding)
4. [Streaming & Playback](#4-streaming--playback)
5. [Live Streaming](#5-live-streaming)
6. [Social](#6-social)
7. [Billing & Subscriptions](#7-billing--subscriptions)
8. [Search](#8-search)
9. [Notifications](#9-notifications)
10. [AI & Chatbot](#10-ai--chatbot)
11. [Viewer Frontend](#11-viewer-frontend)
12. [Admin Frontend](#12-admin-frontend)
13. [Mobile App](#13-mobile-app)
14. [Infrastructure & DevOps](#14-infrastructure--devops)
15. [Observability](#15-observability)
16. [Security](#16-security)
17. [Scale & Performance](#17-scale--performance)
18. [Event-Driven Architecture](#18-event-driven-architecture)
19. [Services Summary](#19-services-summary)

---

## 1. Auth & Users

**Status: Done** — `services/user-service`

| Feature | Details |
|---|---|
| Email + password registration / login | bcrypt hashing; JWT session |
| RS256 JWT (access + refresh) | ~15-min access, long-lived refresh; only user-service holds the private key |
| Token rotation | Refresh invalidates the previous refresh token |
| Token blacklist | Redis `token:blacklist:{jti}` checked on every request |
| Google OAuth2 | django-allauth redirect + callback |
| User profiles | Display name, avatar, bio, country, language, preferences |
| Dynamic RBAC | Roles and permissions in DB; changes apply on next token refresh |
| Built-in roles | superadmin, admin, moderator, premium_subscriber, basic_subscriber, free_trial, guest |
| Custom roles | Admin APIs to create roles and attach permissions |
| Permission cache | Redis `rbac:{user_id}` with 60s TTL; invalidated on role change |
| 7-day free trial | Created on registration via `user.registered` |
| Trial expiry job | Downgrades expired trials |
| Health check | `GET /health` |

**Kafka:** publishes `user.registered`, `user.subscription_changed`

---

## 2. Video Upload & Catalog

**Status: Done** — `services/video-service`

| Feature | Details |
|---|---|
| Presigned multipart upload | Browser PUTs directly to S3; app servers never see video bytes |
| Upload complete | S3 `CompleteMultipartUpload` via video-service |
| Video metadata | Title, description, tags, category; status machine (uploading → processing → ready → failed → deleted) |
| Catalog browse | Filters (category, tags, status, sort) + pagination |
| Video detail | Single-video metadata |
| Publish / unpublish | Controlled publish flow |
| Trending | Sorted by views / time-decay |
| Related videos | Same category / overlapping tags |
| Live replay registration | Idempotent `from_live` internal API |
| Thumbnails | Poster frame + sprite sheet for scrubbing |
| Health check | `GET /health/` |

**Kafka:** publishes `video.uploaded`, `video.published`, `video.unpublished`; consumes `video.transcoded`

---

## 3. Transcoding

**Status: Done** — `services/transcode-worker`

| Feature | Details |
|---|---|
| Multi-bitrate HLS | 480p / 720p / 1080p via FFmpeg |
| DASH manifests | `manifest.mpd` alongside HLS |
| Thumbnail extraction | Poster + sprite sheet |
| Kafka-triggered jobs | Consumes `video.uploaded` |
| Retry + DLQ | Exponential backoff; failures → `video.uploaded.dlq` |
| Idempotent reprocessing | Safe overwrite of S3 outputs |
| Horizontal scale | Stateless workers; Kafka consumer group |
| MediaConvert path | Production alternative to local FFmpeg |

**Kafka:** consumes `video.uploaded`; publishes `video.transcoded`

---

## 4. Streaming & Playback

**Status: Done** — `services/streaming-service`

| Feature | Details |
|---|---|
| HLS manifest serving | Master playlist from S3, filtered per user |
| Adaptive bitrate (ABR) | Client ABR within tier-capped qualities |
| Tier-based quality caps | e.g. guest ≤480p, basic ≤720p, premium ≤1080p+ |
| Watch-position heartbeat | Saves progress to Redis (~30s) |
| Resume playback | Returns last saved position |
| View events | `video.viewed` on manifest requests |
| CloudFront signed URLs | Architecture ready; production CDN wiring remaining |
| Health check | `GET /health` |

---

## 5. Live Streaming

**Status: Done** — `services/live-service` + `infrastructure/nginx-rtmp`

| Feature | Details |
|---|---|
| RTMP ingest | OBS / encoders via nginx-rtmp (`on_publish` hooks) |
| Browser go-live | WebSocket ingest through the gateway; no RTMP client required |
| Stream key management | Create / list / revoke keys |
| Live multi-quality HLS | FFmpeg ladder (1080p / 720p / 480p / 360p; configurable) |
| Segment sync to S3 | Continuous upload + segment index in PostgreSQL |
| Live session listing | Public live sessions API |
| Viewer count | Heartbeat-based presence in Redis |
| Admin force-end | Drops publisher / ends session |
| Automatic VOD replay | Builds replay playlists on stream end |
| Live chat | Socket.io + Redis pub/sub; MongoDB persistence; JWT identity; rate limits |
| Crash recovery | Stale-session sweeper; one active session per key |
| Max duration kill | Configurable stream time limit |
| Health check | `GET /health` |

**Kafka:** publishes `live.started`, `live.ended`, `live.viewer_count`

---

## 6. Social

**Status: Remaining** — `services/social-service`

| Feature | Details |
|---|---|
| Threaded comments | MongoDB; soft delete; max depth |
| Comment likes | Toggle like |
| Moderation & reporting | Auto + manual moderator queue |
| Star ratings (1–5) | One rating per user per video; aggregates |
| Watch history | Append-only; TTL; progress |
| Watchlist / bookmarks | Add / remove |
| Rule-based recommendations | Category + tags, boosted by rating/views |

---

## 7. Billing & Subscriptions

**Status: In progress** — `services/billing-service`

| Feature | Details |
|---|---|
| Multi-provider architecture | Strategy + Factory + Adapter (`PaymentProvider`); Stripe today |
| Plans | Basic / Premium / Family (price, max quality, streams, download flag) |
| Checkout | Hosted checkout session → redirect URL |
| Webhooks | Checkout completed, invoice paid/failed, subscription updated/deleted, trial ending |
| Trial on registration | Consumes `user.registered` → customer + trial |
| Trial expiry job | Daily APScheduler job with Postgres advisory lock |
| Cancel / reactivate | Cancel at period end; un-cancel before end |
| Invoices | History + PDF URL |
| Payment methods | List / add / remove cards |
| Stripe Connect (optional) | Express onboarding; destination charges + application fee |
| Admin subscriptions | List all; issue refunds |
| Dunning | Provider retries + past_due grace → cancel |
| Daily revenue stats | MRR, new subs, churn, trial conversions → Kafka |
| Health check | `GET /health` |

**Kafka:** publishes `billing.trial_started`, `payment.succeeded`, `payment.failed`, `billing.subscription_cancelled`, `billing.trial_expired`, `user.trial_expiring`, `billing.daily_stats`; consumes `user.registered`

---

## 8. Search

**Status: Remaining** — `services/search-service`

| Feature | Details |
|---|---|
| Full-text search | Elasticsearch on title, description, tags |
| Facets & filters | Category, rating, sort (relevance / date / views) |
| Autocomplete | Completion suggester |
| Kafka indexing | Index on `video.transcoded` / publish; remove on delete |
| Bulk re-index | Backfill / recovery script |

---

## 9. Notifications

**Status: Remaining** — `services/notification-service`

| Feature | Details |
|---|---|
| Welcome email | On `user.registered` |
| Trial expiring | On `user.trial_expiring` |
| Payment failed | On `payment.failed` |
| Live started | On `live.started` (followers) |
| Comment reply | On `comment.created` |
| Support ticket confirmation | On `support.ticket_created` |
| Push (FCM) | Mobile: releases, trial, live, replies |

---

## 10. AI & Chatbot

**Status: Remaining** — `services/ai-service`

| Feature | Details |
|---|---|
| Support chatbot | Claude API + tools for billing, account, playback, content |
| Knowledge base | FAQ full-text lookup |
| Ticket escalation | Auto-create support ticket when unresolved |
| Ticket management | User + admin ticket workflows |
| Natural-language movie search | Mood/genre in plain English → ranked results + match reasons |
| Personalization | Skip watched; respect subscription tier |
| Conversation history | PostgreSQL + Redis session cache |
| Rate limits & safety | Per-user caps; PII scrubbing / content filters |

---

## 11. Viewer Frontend

**Status: Done** — `frontend/web-user` (port 3000)

| Feature | Details | Status |
|---|---|---|
| Home / catalog browse | Video cards: thumbnail, title, duration, views | Done |
| HLS watch page | HLS.js ABR player; quality selector | Done |
| Resume playback | Loads saved position; 30s heartbeat | Done |
| Auth | Register, login, access + refresh JWT | Done |
| Account & plans | Profile + subscription plan cards | Done |
| Light / dark theme | Persisted preference | Done |
| Live Now | Live session grid | Done |
| Live watch | Live player + metadata + chat | Done |
| Browser go-live | Camera / screen share broadcasting | Done |
| Safari / iOS HLS fallback | Native `<video>` when needed | Done |
| Search UI | Full-text search + facets | Remaining |
| Comments & ratings | Threaded comments, star ratings | Remaining |
| Watchlist | Bookmarks / save for later | Remaining |
| AI search | Natural-language movie discovery | Remaining |
| Support chat widget | In-app chatbot | Remaining |

---

## 12. Admin Frontend

**Status: Done** — `frontend/web-admin` (port 3001)

| Feature | Details | Status |
|---|---|---|
| Dashboard KPIs | Views, users, revenue signals, queue depth | Done |
| Charts | Views over time, recent signups | Done |
| Video management | List, detail, preview, metadata edit, upload | Done |
| User management | Searchable user list + detail | Done |
| Live monitoring | Monitor / manage live sessions | Done |
| Light / dark theme | Persisted preference | Done |
| RBAC editor | Create roles, attach permissions | Remaining |
| Moderation queue | Review reported comments / content | Remaining |
| Billing admin | Subscriptions, refunds, revenue | Remaining |
| Embedded observability | Metrics / alerts in admin | Remaining |
| Support tickets | Ticket triage and reply | Remaining |

---

## 13. Mobile App

**Status: Remaining**

| Feature | Details |
|---|---|
| iOS + Android | Single Flutter codebase |
| HLS playback | Adaptive player + quality selector |
| Secure JWT storage | Auto-refresh on 401 |
| Catalog + search | Infinite scroll; full-text search |
| Watch resume | Heartbeat + restore |
| Live browse / watch | Live sessions on mobile |
| Comments | Read / write threads |
| Offline downloads | Premium; background; WiFi-only |
| Push notifications | FCM |
| Deep links | Open player by video ID |

---

## 14. Infrastructure & DevOps

| Feature | Details | Status |
|---|---|---|
| Monorepo | `services/`, `frontend/`, `infrastructure/` | Done |
| Docker Compose | Full stack + infra (`make up`) | Done |
| Local Kubernetes | minikube + nginx Ingress (`make k8s-*`) | Done |
| LocalStack S3 | `raw-videos`, `transcoded-videos`, `thumbnails`, `static-assets`, `live-segments` | Done |
| Kafka (KRaft) | Local broker + Kafka UI | Done |
| PostgreSQL / MongoDB / Redis / Elasticsearch | Shared local infra | Done |
| API gateway | Kong (Compose) / nginx Ingress (K8s) | Done |
| GitHub Actions CI | Lint + test per service | Done |
| Terraform IaC | Cloud resources (CloudFront, EKS, etc.) | Done |
| Multi-stage Dockerfiles | Health checks on every service | Done |
| nginx-rtmp | Live RTMP ingest container | Done |
| EKS cluster | Production Kubernetes on AWS | Remaining |
| Helm charts | Per-service packaging | Remaining |
| HPA / KEDA | Autoscaling on CPU, requests, Kafka lag | Remaining |
| ArgoCD GitOps | Declarative continuous delivery | Remaining |
| Istio mTLS | Service mesh mutual TLS | Remaining |
| External Secrets | Secrets Manager → K8s | Remaining |
| PodDisruptionBudgets | Safe rolling updates | Remaining |

---

## 15. Observability

| Feature | Details | Status |
|---|---|---|
| Grafana dashboards | Platform overview metrics | Done (local) |
| Prometheus | Metrics scrape | Done (local) |
| Jaeger | Distributed traces | Done (local) |
| Kibana / Elasticsearch logs | Log exploration | Done (local) |
| Elastic APM | Per-service latency / errors | Done (local) |
| OpenTelemetry end-to-end | Unified OTel pipeline + alerting SLOs | Remaining |
| Production alerting | Error rate, backlog, saturation | Remaining |

---

## 16. Security

| Feature | Details | Status |
|---|---|---|
| Asymmetric JWT (RS256) | Private key only in user-service | Done |
| Token blacklist | Redis revocation | Done |
| Gateway / service JWT verify | `x-user-id` / `x-user-roles` injection where configured | Done |
| RBAC enforcement | Per-endpoint permissions | Done |
| Presigned S3 uploads | No video bytes on app servers | Done |
| Input validation | Pydantic / zod at boundaries | Done |
| Secrets via env / Secrets Manager | No hardcoded credentials | Done |
| Stripe webhook signature verify | Provider signature required | In progress |
| Gateway shared secret | `x-gateway-secret` for header trust | In progress |
| CloudFront signed playback URLs | Short-TTL segment protection | Remaining |
| DRM (Widevine / FairPlay) | MediaPackage | Remaining |
| Service mesh mTLS | Istio | Remaining |

---

## 17. Scale & Performance

**Status: Remaining**

| Feature | Details |
|---|---|
| Redis cache-aside | Metadata, stats, trending, RBAC |
| View-count buffering | Redis `INCR` → periodic DB flush |
| CDN cache policy | Long TTL for immutable segments; short for manifests |
| S3 lifecycle tiering | Standard → Intelligent-Tiering → Glacier / Deep Archive |
| Auto-scaling | CPU / request / Kafka-lag based |
| Spot transcode workers | Cost-optimized batch |
| Read replicas + pooling | RDS replicas + PgBouncer |
| Kafka tuning | Partitions, compression, retention |
| Cost monitoring | Budgets + anomaly alerts |

---

## 18. Event-Driven Architecture

**Status: Done** across active services

| Feature | Details |
|---|---|
| Kafka as async bus | Cross-service communication without shared DBs |
| Dead letter queues | Every consumer: `<topic>.dlq` |
| Local projections | Own DB only; sync via events / internal HTTP |
| Structured events | snake_case payloads; partition keys |

**Core topics:** `user.registered`, `video.uploaded`, `video.transcoded`, `payment.succeeded`, `payment.failed`, `live.started`, `live.ended`, `comment.created`, `support.ticket_created`

---

## 19. Services Summary

| Service | Tech | Port | Status |
|---|---|---|---|
| user-service | Django REST + PostgreSQL + Redis | 8000 | Done |
| video-service | Django REST + PostgreSQL + S3 | 8001 | Done |
| transcode-worker | Python + FFmpeg + Kafka | — | Done |
| streaming-service | Fastify + TypeScript + Redis | 3002 | Done |
| live-service | Fastify + nginx-rtmp + PG/Redis/Mongo/S3 | 3003 | Done |
| billing-service | FastAPI + SQLAlchemy + Stripe | 8003 | In progress |
| social-service | FastAPI + MongoDB | — | Remaining |
| search-service | FastAPI + Elasticsearch | — | Remaining |
| notification-service | FastAPI | — | Remaining |
| ai-service | FastAPI + Claude API | — | Remaining |
| web-user | Next.js | 3000 | Done |
| web-admin | Next.js | 3001 | Done |
