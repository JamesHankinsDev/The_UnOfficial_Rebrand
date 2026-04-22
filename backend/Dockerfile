FROM node:22-slim

WORKDIR /app

# Install deps first for better layer caching.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source.
COPY backend/tsconfig.json ./
COPY backend/src ./src

# Runtime env
ENV NODE_ENV=production

CMD ["npm", "start"]
