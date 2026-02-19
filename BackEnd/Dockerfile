# Backend Development Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Expose backend port
EXPOSE 5000

# Start with nodemon for hot-reload
CMD ["npm", "run", "dev"]