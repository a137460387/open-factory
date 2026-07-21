# Open Factory — Multi-stage Docker build
# Stage 1: Build the application
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lockb* ./
COPY packages/editor-core/package.json ./packages/editor-core/
COPY packages/cli/package.json ./packages/cli/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/
COPY packages/plugin-cli/package.json ./packages/plugin-cli/

# Install dependencies
RUN npm install -g bun@1.3.14 && bun install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY packages/ ./packages/

# Build
RUN bun run typecheck

# Stage 2: Runtime image
FROM node:20-slim AS runtime

WORKDIR /app

# Install FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=builder /app/packages/cli/dist ./packages/cli/dist
COPY --from=builder /app/packages/editor-core/dist ./packages/editor-core/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/cli/package.json ./packages/cli/
COPY --from=builder /app/packages/editor-core/package.json ./packages/editor-core/

# Create symlink for the CLI
RUN ln -s /app/packages/cli/dist/cli.js /usr/local/bin/of && \
    chmod +x /usr/local/bin/of

# Create temp directory
RUN mkdir -p /tmp/open-factory

# Default entrypoint
ENTRYPOINT ["of"]
CMD ["--help"]
