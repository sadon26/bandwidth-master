FROM node:20-bullseye

# install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3001
CMD ["node", "server.js"]
