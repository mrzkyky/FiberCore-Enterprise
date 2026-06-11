FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build step is optional here if we want to run dev server
# RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dev"]
