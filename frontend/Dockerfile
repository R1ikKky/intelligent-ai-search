FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
# package-lock may not be committed yet — use install with legacy-peer-deps for Angular 20 compat
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build -- --configuration production

FROM nginx:alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
# Angular @angular/build:application default output: dist/{projectName}/browser
COPY --from=builder /app/dist/hackaton-frontend/browser /usr/share/nginx/html

EXPOSE 80
