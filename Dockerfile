# FROM node:lts-alpine
#
# RUN apk add --no-cache openssl python3 make g++ postgresql-client
#
# WORKDIR /usr/src/app
#
# COPY package.json package-lock.json ./
# COPY prisma/schema.prisma ./prisma/schema.prisma
#
# RUN npm ci
#
# COPY . .
#
# CMD ["sh", "-c", "npm run db:deploy && npm run dev"]

FROM node:lts-slim AS builder

RUN apt-get update && apt-get install -y \
  openssl python3 make g++ postgresql-client \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate --config=./prisma.config.ts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Production stage: only runtime
FROM node:lts-slim

RUN apt-get update && apt-get install -y \
  openssl postgresql-client \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/dist ./dist

EXPOSE 8000

CMD ["npm", "start"]
