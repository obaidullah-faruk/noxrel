FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS build
RUN npm ci
COPY tsconfig.json .
COPY src/ src/
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json .
EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3002/health || exit 1
CMD ["node", "--import", "./dist/instrumentation.js", "dist/index.js"]
