FROM node:20-alpine AS builder
WORKDIR /app

# ルートの package.json と packages/server の package.json をコピーして依存をインストール
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
RUN npm ci -w packages/server

# ソースをコピーしてビルド
COPY tsconfig.base.json ./
COPY packages/server ./packages/server
RUN npm run build -w packages/server

# --- runtime stage ---
FROM node:20-alpine
WORKDIR /app

# lock ファイルを含む root manifests とパッケージ manifest をコピー
COPY package*.json ./
COPY packages/server/package.json ./packages/server/
RUN npm ci -w packages/server --omit=dev

COPY --from=builder /app/packages/server/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
