# Frontend Development Dockerfile (pnpm workspace)
# Build context: repo root (set in docker-compose.yml)
FROM node:20-alpine

RUN corepack enable
WORKDIR /app

# Copy workspace manifests first for cache-friendly install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY FrontEnd/package.json ./FrontEnd/

RUN pnpm install --frozen-lockfile --filter frontend...

# Copy source last (overlaid by bind mount in dev)
COPY FrontEnd ./FrontEnd

WORKDIR /app/FrontEnd
EXPOSE 5173

# Start Vite dev server with host flag for Docker networking.
# Re-runs pnpm install on container start so newly-added deps land in the
# named node_modules volume without needing a volume rebuild.
CMD ["sh", "-c", "pnpm install --frozen-lockfile --filter frontend... && pnpm dev -- --host 0.0.0.0"]
