# The Vite bundle is architecture-independent, so the build stage always runs
# natively on the build host ($BUILDPLATFORM) instead of under QEMU. Emulated
# arm64 Node crashes V8's JIT (`qemu: uncaught target signal 4`) and builds
# the same static files twice; only the nginx layer below is per-arch.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /web
ARG APP_VERSION=dev
ARG APP_BUILD=
ENV VITE_APP_VERSION=${APP_VERSION}
ENV VITE_APP_BUILD=${APP_BUILD}
# pnpm run build may reconcile node_modules headlessly (e.g. after COPY web/
# overlays a host tree); without CI it aborts with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY.
ENV CI=true
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
COPY VERSION /VERSION
RUN pnpm run build

FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
