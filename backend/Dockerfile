# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

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

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 8080

# Run schema sync and start server
CMD npx prisma db push && npm start
