# 使用Node.js作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖 - 特别添加http-proxy-middleware
RUN npm install http-proxy-middleware && npm install

# 复制所有文件
COPY . .

# 暴露Railway分配的端口
EXPOSE 8080

# 设置环境变量确保正确的监听地址和端口
ENV HOST=0.0.0.0
ENV PORT=8080

# 启动Node.js服务器
CMD ["npm", "start"]