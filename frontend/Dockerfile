# ── Vanguard NIDS – Frontend (multi-stage build) ──────────────────────────

# ── Stage 1: Build the React app ──────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Tell Vite to use relative /api and /ws paths.
# Nginx in Stage 2 proxies those paths to the backend container.
ENV VITE_API_URL=/api

RUN npm run build

# ── Stage 2: Serve with Nginx ──────────────────────────────────────────────
FROM nginx:alpine

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy the Vite production build
COPY --from=builder /app/dist /usr/share/nginx/html

# Drop in our custom server config (handles SPA routing + API proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
