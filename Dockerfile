# Build the static page, then serve it. The page has no backend: everything it
# shows is fetched by the browser from VITE_ARENA_URL, so the URLs are baked at
# build time — rebuilding is how you repoint it.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_ARENA_URL=https://arena.p1x3lz.io
ARG VITE_SPECTATE_URL=https://snake.p1x3lz.io/spectate
ENV VITE_ARENA_URL=$VITE_ARENA_URL \
    VITE_SPECTATE_URL=$VITE_SPECTATE_URL
RUN pnpm build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
