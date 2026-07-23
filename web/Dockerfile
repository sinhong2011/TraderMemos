FROM node:24-alpine AS build
WORKDIR /web
ARG APP_VERSION=dev
ARG APP_BUILD=
ENV VITE_APP_VERSION=${APP_VERSION}
ENV VITE_APP_BUILD=${APP_BUILD}
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
COPY VERSION /VERSION
RUN pnpm run build

FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
