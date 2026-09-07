# Build it yourself. No image is published, because an MCP server that holds a
# session string should come from source you can read.
#
#   docker build -t telegram-mcp .
#   docker run --rm -i -e TELEGRAM_API_ID -e TELEGRAM_API_HASH -e TELEGRAM_SESSION telegram-mcp

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY README.md LICENSE SKILL.md ./

# stdio is the transport, so the container must stay attached and never write
# anything of its own to stdout.
ENTRYPOINT ["node", "dist/index.js"]
