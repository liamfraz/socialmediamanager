FROM node:20-alpine

WORKDIR /app

# Install dependencies (including devDeps for build)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "start.js"]
