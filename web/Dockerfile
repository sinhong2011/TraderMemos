FROM node:22 AS build
WORKDIR /web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /web/dist /usr/share/nginx/html
