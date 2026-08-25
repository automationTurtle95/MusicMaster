FROM node:20-alpine

WORKDIR /app

# Abhängigkeiten zuerst (besserer Layer-Cache).
COPY package*.json ./
RUN npm ci

# Quellcode + Build.
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Langlaufender, stateful Server (kein Serverless) – ermöglicht lokale
# Dateiablage für hochgeladene Noten-PDFs (siehe LUH-116).
CMD ["npm", "run", "start"]
