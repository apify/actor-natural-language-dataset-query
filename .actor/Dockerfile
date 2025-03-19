FROM oven/bun:alpine AS builder
ENV NODE_ENV=production

WORKDIR /app

# copy project and source
COPY ./package.json ./tsconfig.json ./bun.lock ./
COPY ./src ./src
RUN ls -la

# install dependencies
RUN bun install --frozen-lockfile --production

# build
RUN bun build --target bun --outdir ./dist ./src/index.ts

FROM oven/bun:alpine

WORKDIR /app

# copy node_modules
COPY --from=builder /app/node_modules /app/node_modules

# copy built files
COPY --from=builder /app/dist /app/dist

# run
CMD ["bun", "run", "./dist/index.js"]
