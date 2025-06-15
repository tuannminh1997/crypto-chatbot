>>> Crypto Chatbot - Docker Deploy Guide

# Bước 1: 
Thêm Claude API key vào backend/.env

# Bước 2: Cài Docker
Download và cài đặt Docker Desktop tại: https://www.docker.com/products/docker-desktop

## Bước 3: Build Docker image
Mở terminal tại thư mục project (có Dockerfile sẵn)
Chạy lần lượt các lệnh:
docker build -t crypto-chatbot .
docker run -p 8000:8000 --env-file backend/.env crypto-chatbot

### Bước 4: 
Mở trình duyệt http://localhost:8000