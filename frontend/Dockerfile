# 使用Node.js作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制所有文件
COPY . .

# 暴露端口
EXPOSE 3000

# 设置环境变量确保正确的监听地址
ENV HOST=0.0.0.0

# 启动Node.js服务器
CMD ["npm", "start"]