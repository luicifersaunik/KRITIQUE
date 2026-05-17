FROM node:20-alpine

WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate --schema prisma/schema.prisma

CMD ["npm", "run", "dev"]
