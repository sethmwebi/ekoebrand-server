FROM node:lts-alpine

RUN apk add --no-cache openssl python3 make g++ postgresql-client

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma

RUN npm ci

COPY . .

CMD ["sh", "-c", "npm run db:deploy && npm run dev"]
