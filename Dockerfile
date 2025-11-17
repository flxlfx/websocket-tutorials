FROM oven/bun:1.3.2-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
EXPOSE 3334
CMD ["bun", "run", "src/server.ts"]