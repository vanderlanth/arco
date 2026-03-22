FROM node:22-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN node scripts/download-yt-dlp.mjs
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
