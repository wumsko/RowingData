# Use the official lightweight Nginx image as a base
FROM nginx:alpine

# Set the working directory inside the container
WORKDIR /usr/share/nginx/html

# Copy the local project files from your machine to the container's web root
# The first '.' refers to the current directory (where your Dockerfile is).
# The second '.' refers to the WORKDIR we set above.
COPY . .