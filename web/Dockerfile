# syntax=docker/dockerfile:1
# Production image for Azure Container Apps (or any container host).
# Startup runs `prisma migrate deploy` (idempotent) before the server.

FROM node:22-alpine AS base
RUN apk add --no-cache openssl

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
RUN npm i -g prisma@6
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
# the / and /dashboard route handlers read these at runtime
COPY --from=build /app/src/html ./src/html
EXPOSE 3000
CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
