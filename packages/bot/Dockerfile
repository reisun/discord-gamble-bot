FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/bot/package*.json ./packages/bot/
RUN npm ci -w packages/bot

COPY tsconfig.base.json ./
COPY packages/bot ./packages/bot
RUN npm run build -w packages/bot

# --- runtime stage ---
FROM node:20-alpine
WORKDIR /app

# lock ファイルを含む root manifests とパッケージ manifest をコピー
COPY package*.json ./
COPY packages/bot/package.json ./packages/bot/
RUN npm ci -w packages/bot --omit=dev

COPY --from=builder /app/packages/bot/dist ./dist

CMD ["sh", "-c", "node dist/scripts/deploy-commands.js && node dist/index.js"]
