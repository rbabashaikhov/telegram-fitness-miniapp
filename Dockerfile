# Single-service image: Express serves /api/* and the React static build.
# SQLite lives at DATABASE_PATH (default /data/fitness.db).

FROM node:20-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci

FROM deps AS build

COPY backend ./backend
COPY frontend ./frontend

ENV VITE_API_URL=

RUN npm run build -w backend \
  && npm run build -w frontend

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ wget \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./backend/public

RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/fitness.db
ENV PUBLIC_DIR=/app/backend/public
ENV PORT=3000
ENV ALLOW_DEMO_MODE=true
ENV TZ=Europe/Moscow
ENV DATA_MODE=local
ENV EVENT_ADAPTER=local
ENV NOTIFICATION_ADAPTER=local

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "backend/dist/index.js"]
