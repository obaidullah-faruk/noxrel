# web-user

Viewer-facing Next.js app for the video streaming platform. Runs on **port 3000**.

## Features

- Browse and watch videos with HLS adaptive streaming (`hls.js`)
- User registration, login, and token-based auth (access + refresh JWT)
- Watch position resume (heartbeat + resume API)
- Subscription plans page
- Account profile page
- Light / dark theme toggle

## Tech

- Next.js 16 · React 19 · TypeScript
- MUI v9 (Material UI) + Tailwind CSS v4
- `hls.js` for HLS playback
- `swr` for data fetching
- `zod` for runtime validation

## Project Layout

```
src/
  app/
    (public)/           # Authenticated viewer routes (home, videos, account, subscriptions)
    api/auth/           # Next.js route handlers — proxy to user-service
    api/stream/         # Next.js route handlers — proxy to streaming-service
    login/              # Login page
    signup/             # Registration page
  components/
    Auth/               # AuthContext — session state
    Layout/             # AppHeader
    ThemeToggle/        # ThemeContext + toggle button
    VideoCard/          # Video thumbnail card
    VideoPlayer/        # HLS player wrapper
  lib/
    api.ts              # Base fetch helpers
    auth.ts / auth-client.ts  # Server-side / client-side auth utilities
    jwt-cookies.ts      # Cookie read/write for JWT tokens
    streaming.ts        # Streaming API helpers
    theme.ts            # MUI theme definition
  types/
    user.ts
    video.ts
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the values:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Kong proxy base URL (e.g. `http://localhost:8100`) |
| `NEXT_PUBLIC_STREAMING_URL` | Streaming-service base URL (e.g. `http://localhost:3002`) |

## Getting Started

```bash
cd frontend/web-user
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Start production server on port 3000 |
| `npm run lint` | Run ESLint |

## API Dependencies

All API calls proxy through Kong on port 8100. The backend services must be running:

```bash
# From the repo root
make up
```

| Route | Proxied to |
|---|---|
| `/api/v1/auth/*` | user-service:8000 |
| `/api/v1/users/*` | user-service:8000 |
| `/api/v1/catalog/*` | video-service:8001 |
| `/api/v1/stream/*` | streaming-service:3002 |
