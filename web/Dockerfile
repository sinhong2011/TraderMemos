FROM oven/bun:canary AS build
WORKDIR /web
ARG APP_VERSION=dev
ARG APP_BUILD=
ENV VITE_APP_VERSION=${APP_VERSION}
ENV VITE_APP_BUILD=${APP_BUILD}
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
COPY VERSION /VERSION
RUN bun run build

FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
