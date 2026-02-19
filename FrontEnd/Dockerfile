# Frontend Development Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server with host flag for Docker networking
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]