FROM nginx:stable-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY *.html *.css *.js /usr/share/nginx/html/
COPY art/ /usr/share/nginx/html/art/
COPY audio/music/ /usr/share/nginx/html/audio/music/
COPY audio/broadcast/en/ /usr/share/nginx/html/audio/broadcast/en/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
