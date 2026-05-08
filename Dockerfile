# Use a lightweight Node.js environment
FROM node:20-alpine

# Hugging Face Spaces strictly require applications to run as a non-root user (UID 1000).
# The node:20-alpine image natively comes with a user named "node" (UID 1000) which we will use.

# Enforce Hugging Face's strict network port policy
ENV PORT=7860
EXPOSE 7860

# Set the working directory
WORKDIR /app

# Change ownership of the working directory so our non-root user has full access
RUN chown -R node:node /app

# Switch to the secure non-root user
USER node

# Copy dependency graphs first for Docker layer caching
COPY --chown=node:node package*.json ./

# Install packages
RUN npm install

# Copy your Typescript source code
COPY --chown=node:node . .

# Compile the Express server from TypeScript to standard JavaScript natively
RUN npm run build

# Boot the API server securely on Port 7860
CMD ["npm", "run", "start"]
