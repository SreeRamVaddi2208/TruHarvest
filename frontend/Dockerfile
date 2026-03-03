FROM node:20-slim

WORKDIR /app

# Install dependencies needed for some node versions/packages
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (ignoring scripts for now if any, to avoid build errors)
RUN npm install

# Copy source code
COPY . .

# Expose port 3000
EXPOSE 3000

# Set dynamic environment variables at runtime if needed
# But for Next.js, build-time variables are often needed for static optimization.
# I'll use a simple dev setup as in Animal_Kart.

CMD ["npm", "run", "dev"]
