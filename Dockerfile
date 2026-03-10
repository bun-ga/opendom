FROM docker.io/oven/bun:1.3.10 AS bun

FROM docker.io/node:22-bookworm-slim AS build

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace manifests first so Bun can reuse install layers.
COPY package.json bun.lock turbo.json ./
COPY apps/docs-web/package.json apps/docs-web/package.json
COPY apps/opendom-cli/package.json apps/opendom-cli/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json

RUN bun install --frozen-lockfile

# Copy the docs app after installing dependencies. Root .dockerignore keeps
# local build output and node_modules out of the image context.
COPY apps/docs-web ./apps/docs-web

WORKDIR /app/apps/docs-web

# Vocs builds reliably in the container when executed with Node.
RUN node ./node_modules/vocs/_lib/cli/index.js build

FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine AS runner

COPY <<'NGINX' /etc/nginx/conf.d/default.conf
server {
  listen 8080;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri.html $uri/index.html =404;
  }
}
NGINX

COPY --from=build /app/apps/docs-web/docs/dist/ /usr/share/nginx/html/

EXPOSE 8080
