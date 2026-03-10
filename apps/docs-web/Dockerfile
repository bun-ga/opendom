# Build Stage
FROM oven/bun:1.3.10-alpine AS build

WORKDIR /app

# Copy monorepo config
COPY package.json bun.lock ./

# Copy the docs project
COPY apps/docs-web ./apps/docs-web

# Install dependencies
RUN bun install --frozen-lockfile

# Build static site
WORKDIR /app/apps/docs-web
RUN bun run build

# Runtime Stage
FROM oven/bun:1.3.10-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S vocsuser -u 1001
USER vocsuser

# Copy static assets from Vocs build output
COPY --from=build --chown=vocsuser:nodejs /app/apps/docs-web/docs/dist ./public
COPY --from=build --chown=vocsuser:nodejs /app/apps/docs-web/serve.ts ./serve.ts

# Set default port to 5173 (Vocs default)
EXPOSE 5173

# Start serving the docs
CMD ["bun", "run", "serve.ts"]
