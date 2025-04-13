const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Хранилище для токенов
const tokenStore = new Map();

// Глобальные настройки axios для работы с куками
const axiosInstance = axios.create({
  withCredentials: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
});

/**
 * Прокси-эндпоинт для загрузки платежной формы
 */
app.get('/proxy-payzaty', async (req, res) => {
  try {
    const paymentUrl = 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e';
    
    // 1. Получаем оригинальную страницу с куками
    const response = await axiosInstance.get(paymentUrl);
    
    // 2. Извлекаем токен из формы и куки из ответа
    const $ = cheerio.load(response.data);
    const token = $('input[name="__RequestVerificationToken"]').val();
    const cookies = response.headers['set-cookie'];
    
    // 3. Сохраняем токен и куки в хранилище
    const sessionId = req.cookies.sessionId || generateSessionId();
    tokenStore.set(sessionId, { token, cookies });
    
    // 4. Модифицируем страницу
    $('.amount, .pay-amount').remove();
    
    // 5. Подменяем action формы на наш обработчик
    $('form').attr('action', '/handle-payment');
    
    // 6. Устанавливаем куки сессии
    res.cookie('sessionId', sessionId, { 
      httpOnly: true, 
      sameSite: 'None', 
      secure: true 
    });
    
    res.send($.html());
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Payment gateway error');
  }
});

/**
 * Обработчик POST-запросов
 */
app.post('/handle-payment', async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;
    if (!tokenStore.has(sessionId)) {
      return res.status(403).send('Invalid session');
    }

    // 1. Получаем сохраненные данные
    const { token, cookies } = tokenStore.get(sessionId);
    
    // 2. Формируем заголовки с оригинальными куками
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies.join('; '),
      'Origin': 'https://www.payzaty.com',
      'Referer': 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    // 3. Формируем данные формы
    const formData = new URLSearchParams();
    for (const key in req.body) {
      formData.append(key, req.body[key]);
    }
    formData.append('__RequestVerificationToken', token);
    
    // 4. Отправляем запрос в Payzaty
    const response = await axiosInstance.post(
      'https://www.payzaty.com/payment/process',
      formData.toString(),
      { headers }
    );
    
    // 5. Обрабатываем ответ
    if (response.headers.location) {
      return res.redirect(response.headers.location);
    }
    
    res.send(response.data);
  } catch (error) {
    console.error('Payment error:', error.response?.data || error.message);
    res.status(500).send('Payment processing failed');
  }
});

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
