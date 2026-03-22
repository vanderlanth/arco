FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN node scripts/download-yt-dlp.mjs

# Placeholder env vars so SvelteKit's post-build analysis can import server modules.
# Real values are injected at runtime by Koyeb.
ENV TURSO_URL=libsql://placeholder
ENV TURSO_AUTH_TOKEN=placeholder
ENV APP_SECRET=placeholder
ENV APP_PASSWORD=placeholder
ENV SPOTIFY_CLIENT_ID=placeholder
ENV SPOTIFY_CLIENT_SECRET=placeholder
ENV SPOTIFY_REDIRECT_URI=https://placeholder

RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app

COPY --from=builder /app/build build/
COPY --from=builder /app/bin bin/
COPY package*.json ./
RUN npm ci --omit=dev

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "build"]
