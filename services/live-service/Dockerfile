# live-service needs the ffmpeg binary in every runtime stage — it spawns
# `ffmpeg` as a child process per live session.
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache ffmpeg
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS dev
RUN npm ci

FROM base AS build
RUN npm ci
COPY tsconfig.json .
COPY src/ src/
RUN npm run build

# Migration runner: needs the (dev) node-pg-migrate binary AND the SQL files under
# src/db/migrations. The production stage has neither, so the k8s migrate init
# container uses this target: `npm run migrate up`.
FROM build AS migrate

FROM node:24-alpine AS production
WORKDIR /app
RUN apk add --no-cache ffmpeg
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json .
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/index.js"]
