FROM oven/bun:1.3 AS builder
WORKDIR /app
COPY package.json ./
COPY packages/sdk/package.json packages/sdk/
COPY packages/core/package.json packages/core/
COPY packages/provider-deepseek/package.json packages/provider-deepseek/
COPY packages/ui/package.json packages/ui/
RUN bun install
COPY . .
RUN cd packages/ui && bun run build || true
EXPOSE 4123
ENV NOVA_UI_DIR=./packages/ui/dist
ENV NOVA_PORT=4123
ENV NOVA_HOST=0.0.0.0
CMD ["bun", "run", "packages/core/src/main.ts"]
