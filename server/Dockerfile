FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js db.js ./
COPY public ./public
ENV PORT=3000
ENV BF_DB=/data/ballfive.db
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.js"]
