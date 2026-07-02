# tiangolo/nginx-rtmp is amd64-only and runs under slow emulation on Apple
# Silicon. alfg/nginx-rtmp ships the nginx-rtmp-module (including
# rtmp_control, which live-service uses to drop publishers). The published
# image is linux/amd64 — k8s-build passes --platform=linux/amd64 explicitly.
FROM alfg/nginx-rtmp:latest

# alfg's default CMD runs envsubst on nginx.conf.template at startup, which
# overwrites any COPY to nginx.conf. Replace the template and skip envsubst —
# our config has no ${ENV} placeholders.
COPY nginx.conf /etc/nginx/nginx.conf.template
COPY nginx.conf /etc/nginx/nginx.conf
CMD ["nginx", "-g", "daemon off;"]

EXPOSE 1935 8080
