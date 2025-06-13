FROM node:22-alpine AS build-stage

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:22-alpine AS run-stage

WORKDIR /app

COPY --from=build-stage /app/dist /app/dist
COPY package*.json ./

RUN npm install

EXPOSE 4000

CMD ["node", "dist/index.js"]
