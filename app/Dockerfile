# Bộ khung Dockerfile — Task 1.
# Chỉ đóng gói app Express tối thiểu. Cấu hình đầy đủ (healthcheck, biến môi
# trường, volume) sẽ hoàn thiện ở Task 9.

FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /usr/src/app

# Copy manifest trước để tận dụng cache layer khi dependency không đổi.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# Chạy bằng user non-root có sẵn trong image node (hardening tối thiểu).
USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
