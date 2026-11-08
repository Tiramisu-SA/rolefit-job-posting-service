# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Seed asset (tsc does not copy non-TS files); read at runtime by dist/scripts/seed.js
COPY src/scripts/templates ./dist/scripts/templates
# The .proto file is loaded at runtime by @grpc/proto-loader
COPY proto ./proto

# HTTP (/health), gRPC
EXPOSE 3003 50052

USER node
CMD ["node", "dist/server.js"]
