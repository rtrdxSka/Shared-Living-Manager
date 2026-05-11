# Backend Development Dockerfile (pnpm workspace)
# Build context: repo root (set in docker-compose.yml)
FROM node:20-alpine

RUN corepack enable
WORKDIR /app

# Copy workspace manifests first for cache-friendly install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY BackEnd/package.json ./BackEnd/

RUN pnpm install --frozen-lockfile --filter backend...

# Copy source last (overlaid by bind mount in dev)
COPY BackEnd ./BackEnd

WORKDIR /app/BackEnd
EXPOSE 5000

# Start with nodemon for hot-reload
CMD ["pnpm", "dev"]
