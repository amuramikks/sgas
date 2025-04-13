const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cookieParser = require('cookie-parser');
const { URLSearchParams } = require('url');

const app = express();
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Хранилище для сессий (в продакшене используйте Redis)
const sessions = new Map();

// Глобальный экземпляр axios с обработкой кук
const axiosPayzaty = axios.create({
  baseURL: 'https://www.payzaty.com',
  withCredentials: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
});

/**
 * Загрузка и модификация платежной формы
 */
app.get('/proxy-payzaty', async (req, res) => {
  try {
    // 1. Загрузка оригинальной формы
    const response = await axiosPayzaty.get('/payment/pay/b30c92ee7a214814ad0bf43a72bf634e');
    
    // 2. Извлечение Anti-CSRF токена и кук
    const $ = cheerio.load(response.data);
    const token = $('input[name="__RequestVerificationToken"]').val();
    const cookies = response.headers['set-cookie'];

    // 3. Сохранение сессии
    const sessionId = req.cookies.sessionId || generateSessionId();
    sessions.set(sessionId, { token, cookies });

    // 4. Модификация страницы
    $('.amount, .pay-amount').remove();
    $('form').attr('action', '/handle-payment');

    // 5. Установка куки сессии
    res.cookie('sessionId', sessionId, { 
      httpOnly: true, 
      secure: true,
      sameSite: 'None'
    });

    res.send($.html());
  } catch (error) {
    console.error('Ошибка прокси:', error);
    res.status(500).send('Ошибка загрузки платежной страницы');
  }
});

/**
 * Обработка платежа
 */
app.post('/handle-payment', async (req, res) => {
  try {
    // 1. Проверка сессии
    const sessionId = req.cookies.sessionId;
    if (!sessions.has(sessionId)) return res.status(403).send('Сессия устарела');
    
    // 2. Получение сохраненных данных
    const { token, cookies } = sessions.get(sessionId);
    
    // 3. Формирование данных
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(req.body)) {
      formData.append(key, value);
    }
    formData.set('__RequestVerificationToken', token);

    // 4. Отправка данных в Payzaty
    const response = await axiosPayzaty.post('/payment/process', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.join('; '),
        'Origin': 'https://www.payzaty.com',
        'Referer': 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e'
      },
      maxRedirects: 0
    });

    // 5. Перенаправление клиента
    if (response.headers.location) {
      return res.redirect(response.headers.location);
    }
    res.send(response.data);
  } catch (error) {
    console.error('Ошибка платежа:', error.response?.data || error.message);
    res.status(500).send('Ошибка обработки платежа');
  }
});

// Вспомогательные функции
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Запуск сервера
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
