FROM node:24-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV PORT=8124 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8124
CMD ["node", "server.js"]
