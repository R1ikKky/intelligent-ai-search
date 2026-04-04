FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
# package-lock отсутствует; TS 6 vs peer ts-jest — legacy-peer-deps для стабильной сборки
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --legacy-peer-deps --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
