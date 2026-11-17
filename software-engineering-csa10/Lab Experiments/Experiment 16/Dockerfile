# Experiment 16 - Static website served with Nginx
FROM nginx:alpine

# custom server config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# copy website files into the Nginx web root
COPY website/ /usr/share/nginx/html/

EXPOSE 80

# nginx:alpine already starts nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
