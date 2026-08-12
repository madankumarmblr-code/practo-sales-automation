# Multi-stage production image — single port, API + UI
FROM node:22-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm install

COPY backend ./backend
COPY frontend ./frontend

RUN npm run build -w frontend

# --- runtime ---
FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN npm install --omit=dev -w backend && npm cache clean --force

COPY backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist

RUN mkdir -p /data

EXPOSE 8080

VOLUME ["/data"]

CMD ["node", "backend/src/index.js"]
