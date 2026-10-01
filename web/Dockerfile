# Stepwell web (Next.js standalone). Build from the repository root (pnpm workspace):
#   docker build -f web/Dockerfile -t stepwell-web --build-arg API_INTERNAL_URL=http://api:8000 .
# API_INTERNAL_URL is baked into the /api/v1 rewrite at build time and read again at runtime by server components.
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY web/package.json web/
COPY mobile/package.json mobile/
RUN pnpm install --frozen-lockfile --filter @stepwell/web... --ignore-scripts

FROM deps AS build
ARG API_INTERNAL_URL=http://api:8000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_NAME=Stepwell
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME NEXT_TELEMETRY_DISABLED=1
COPY packages/shared packages/shared
COPY web web
RUN pnpm --filter @stepwell/web build

FROM node:22-alpine
LABEL org.opencontainers.image.title="stepwell-web" org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S -g 10001 stepwell && adduser -S -u 10001 -G stepwell stepwell
COPY --from=build --chown=stepwell:stepwell /repo/web/.next/standalone ./
COPY --from=build --chown=stepwell:stepwell /repo/web/.next/static ./web/.next/static
COPY --from=build --chown=stepwell:stepwell /repo/web/public ./web/public
USER stepwell
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/en >/dev/null || exit 1
CMD ["node", "web/server.js"]
