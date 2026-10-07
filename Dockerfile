# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Desarrollo: servidor Metro accesible desde la red local (Expo Go / dev build)
FROM deps AS dev
COPY . .
ENV EXPO_NO_TELEMETRY=1
EXPOSE 8081
CMD ["npx", "expo", "start", "--lan"]

# ---- Build web estático (mismo artefacto que se publica en Vercel)
FROM deps AS build
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL \
    EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY \
    EXPO_NO_TELEMETRY=1
COPY . .
RUN npx expo export --platform web --output-dir dist

FROM nginx:1.27-alpine AS web
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
