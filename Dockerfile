# Production-grade Node.js 22 (LTS) environment
FROM node:22-slim

# Install basic tools for healthchecks or debugging
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy source and config
COPY . .

# Build the TypeScript project
RUN npm run build

# Default environment variables
ENV PROJECTS_ROOT=/projects
ENV NODE_ENV=production

# The MCP server communicates over stdio, no ports need exposing by default
# but we can label it for discovery
LABEL org.opencontainers.image.title="Hardened MCP Hub"
LABEL org.opencontainers.image.description="Containerized MCP Hub for Deterministic Agentic Workflows"

CMD ["npm", "start"]
