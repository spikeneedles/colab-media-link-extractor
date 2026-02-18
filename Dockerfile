# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source files
COPY . .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Set labels
LABEL maintainer="Media Link Scanner Team"
LABEL description="AI-powered IPTV & Kodi Media Link Scanner"
LABEL version="1.0.0"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
