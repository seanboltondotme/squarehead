# Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Runtime: PHP + backend + frontend static
FROM php:8.2-cli-alpine
RUN apk add --no-cache libzip-dev icu-dev oniguruma-dev \
    && docker-php-ext-configure intl \
    && docker-php-ext-install -j$(nproc) pdo pdo_mysql zip intl opcache

WORKDIR /app/backend

COPY backend/ .
RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer \
    && composer install --no-dev

# Copy built frontend into public (SPA + router will serve it)
COPY --from=frontend /app/frontend/dist/index.html ./public/
COPY --from=frontend /app/frontend/dist/assets ./public/assets/

# Railway sets PORT
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT} -t public public/router.php"]
