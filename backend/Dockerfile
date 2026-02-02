# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install

# Copy source and generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Copy rest and build
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

# Copy node_modules (including Prisma client)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/assets ./assets

# Create data and content directories
RUN mkdir -p /app/data /app/content

EXPOSE 8080

# Run schema sync and start server
CMD npx prisma db push --accept-data-loss && npm start
