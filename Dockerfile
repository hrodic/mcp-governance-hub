# Production-grade Node.js 22 LTS environment
FROM node:22-slim

# Install curl (for healthchecks) and python3 (for OSV dependency scanning)
RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  python3 \
  python-is-python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN chown node:node /app

# The node image already includes a non-root 'node' user with a proper home directory (/home/node).
# Switching to it before running npm ci prevents the EACCES '/nonexistent' error.
USER node

# Copy lockfile + manifest first for optimal layer caching
COPY --chown=node:node package*.json ./

# Install all deps (including dev) — tsc and vitest are needed inside the container.
# For a local governance hub, keeping devDeps in the image is the right trade-off.
# A multi-stage slim build is an option if image size becomes a concern.
RUN npm ci

# Copy compiled source (pre-built) and config
COPY --chown=node:node . .

# Build the TypeScript project
RUN npm run build

# Default environment variables
ENV PROJECTS_ROOT=/projects
ENV NODE_ENV=production

# MCP communicates over stdio — no ports needed
LABEL org.opencontainers.image.title="MCP Governance Hub"
LABEL org.opencontainers.image.description="Containerized MCP Hub for Deterministic Agentic Workflows"
LABEL org.opencontainers.image.licenses="MIT"

CMD ["node", "dist/index.js"]
