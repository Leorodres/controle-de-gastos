FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY migrations ./migrations
COPY src ./src
# compila (nest build) e remove as dependências de desenvolvimento; o tsx fica para os scripts migrate/import
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3000
# aplica migrations pendentes e sobe a API.
# Scripts pontuais: docker compose run --rm api npm run import -- /data/Gastos.xlsx
CMD ["sh", "-c", "npm run migrate && node dist/main"]
