FROM node:20-slim

RUN apt-get update
RUN apt-get install -y openssl wget libkrb5-dev

ARG TARGETARCH

WORKDIR /app

EXPOSE 3000

COPY . /app

# All commands in one line will reduce the size of the image
# RUN npm install @nestjs/cli@9.0.0 -g && npm install --omit=dev && npm run build && npm remove @nestjs/cli -g && npm cache clean --force && rm -rf /app/src/*

CMD [ "node", "dist/main" ]