# Sjodur frontend – Vike + Vue served by Hono. Build: docker build -t sjodur-frontend .
FROM node:24-alpine AS base
RUN npm install -g pnpm@10.34.5
WORKDIR /app

# all dependencies for the build
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# production-only dependencies for the runtime image
FROM base AS deps-prod
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build && pnpm licenses:notices

# runtime
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY package.json ./
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/THIRD-PARTY-NOTICES.md ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "./dist/server/index.mjs"]
