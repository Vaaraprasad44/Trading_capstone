# Capstone deployment image — Next.js standalone + Prisma migrate-on-start.
#
# Build context is the repo root; the app lives in web/.
# Requires web/next.config.ts to include:  output: 'standalone'
# The entrypoint runs `prisma migrate deploy` BEFORE the server starts — the
# Day 4 rule ("always migrate before deploying new code") encoded in the image.

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /src
COPY web/package*.json ./
RUN npm ci
COPY web/ .
RUN npx prisma generate && npm run build

# ---- runtime stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

# Next standalone output + static assets
COPY --from=build /src/.next/standalone ./
COPY --from=build /src/.next/static ./.next/static
COPY --from=build /src/public ./public

# Prisma: schema + migrations + the CLI for `migrate deploy` at startup.
# NOTE: cherry-picking node_modules/prisma + @prisma out of the build stage
# does NOT work on Prisma 6 — the CLI relies on hoisted transitive deps
# (c12, effect, ...). A pinned global install is self-contained.
COPY --from=build /src/prisma ./prisma
RUN npm i -g prisma@6 tsx

EXPOSE 3000
CMD ["sh", "-c", "prisma migrate deploy && tsx prisma/seed.ts && node server.js"]
