# ---------- 构建阶段 ----------
FROM node:20-alpine AS builder
WORKDIR /app

# 优先复制依赖清单，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码并构建静态资源
COPY . .
RUN npm run build

# ---------- 运行阶段：nginx 托管静态文件 ----------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
