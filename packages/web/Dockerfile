FROM node:20-alpine
WORKDIR /app

# lock ファイルを含む root manifests とパッケージ manifest をコピー
COPY package*.json ./
COPY packages/web/package*.json ./packages/web/
RUN npm ci -w packages/web

COPY packages/web ./packages/web

EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "packages/web", "--", "--host", "0.0.0.0"]
