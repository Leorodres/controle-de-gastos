FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY migrations ./migrations
COPY src ./src

# padrão: aplicar migrations. Outros comandos: docker compose run --rm api npm run <script>
CMD ["npm", "run", "migrate"]
