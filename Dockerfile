# Use a base image
FROM node:20.11.1-alpine3.19
WORKDIR /app
COPY . .
RUN yarn build
EXPOSE 3333
CMD ["yarn", "start"]