# BUILD STAGE
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL_BASE
ENV VITE_API_URL_BASE=$VITE_API_URL_BASE
RUN npm run build

# PRODUCTION STAGE
FROM nginx:stable-alpine as production-stage
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
