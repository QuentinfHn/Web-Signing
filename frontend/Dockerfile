# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production stage - nginx
FROM nginx:alpine AS runner

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Default backend URL for Docker Compose (can be overridden)
ENV BACKEND_URL=http://backend:8080

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

