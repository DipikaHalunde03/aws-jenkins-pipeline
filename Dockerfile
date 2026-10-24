FROM nginx:alpine
RUN apk upgrade --no-cache
COPY src/ /usr/share/nginx/html/
EXPOSE 80