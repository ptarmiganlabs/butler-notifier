# Use Node 8 LTS
FROM node:19

# Create app dir inside container
WORKDIR /nodeapp

# Install app dependencies separately (creating a separate layer for node_modules, effectively caching them between image rebuilds)
COPY package.json .
RUN npm install

# Copy app's source files
COPY . .


# Create and use non-root user 
RUN groupadd -r nodejs \
   && useradd -m -r -g nodejs nodejs

USER nodejs


CMD ["node", "index.js"]

