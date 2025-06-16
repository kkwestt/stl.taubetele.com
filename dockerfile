# Используем официальный Node.js образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --only=production

# Копируем остальные файлы приложения
COPY . .

# Создаем директорию public и копируем туда index.html
RUN mkdir -p public
COPY public/index.html public/

# Открываем порт 3000
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]