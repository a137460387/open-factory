# Multi-stage build for the collaboration server
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare bun@1.3.14 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json ./
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS build
COPY package.json tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN bun install --frozen-lockfile
RUN bun run build

# Production image
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare bun@1.3.14 --activate
WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 -S collab && \
    adduser -S collab -u 1001 -G collab

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

ENV NODE_ENV=production
ENV COLLAB_PORT=3001

EXPOSE 3001

USER collab

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/server.js"]
