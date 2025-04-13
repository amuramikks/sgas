const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cookieParser());

// Хранилище для токенов (в продакшене используйте Redis)
const tokenStore = new Map();

/**
 * Прокси для статических ресурсов Payzaty
 */
app.use(
  '/payzaty',
  createProxyMiddleware({
    target: 'https://www.payzaty.com',
    changeOrigin: true,
    pathRewrite: { '^/payzaty': '' },
    cookieDomainRewrite: 'sgas-nlcb.onrender.com',
    onProxyRes(proxyRes) {
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      if (proxyRes.headers['set-cookie']) {
        proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map((cookie) =>
          cookie
            .replace(/;\s*Secure/gi, '')
            .replace(/;\s*SameSite=\w+/gi, '; SameSite=None')
        );
      }
    },
  })
);

/**
 * Главный прокси-эндпоинт для платежной страницы
 */
app.get('/proxy-payzaty', async (req, res) => {
  try {
    const paymentUrl = 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e';
    
    // 1. Получаем оригинальную страницу с токеном
    const response = await axios.get(paymentUrl, {
      withCredentials: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // 2. Извлекаем токен из формы
    const $ = cheerio.load(response.data);
    const token = $('input[name="__RequestVerificationToken"]').val();
    
    // 3. Сохраняем токен в хранилище (привязываем к сессии)
    const sessionId = req.cookies.sessionId || generateSessionId();
    tokenStore.set(sessionId, token);
    
    // 4. Модифицируем страницу
    $('.amount').remove();
    $('.pay-amount').remove();
    
    // 5. Переписываем все URL для работы через прокси
    $('[href^="/"]').each((_, el) => {
      $(el).attr('href', '/payzaty' + $(el).attr('href'));
    });
    $('[src^="/"]').each((_, el) => {
      $(el).attr('src', '/payzaty' + $(el).attr('src'));
    });
    
    // 6. Подменяем action формы на наш обработчик
    $('form').attr('action', '/handle-payment');
    
    // 7. Устанавливаем куки для сессии
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
 * Обработчик POST-запросов платежной формы
 */
app.post('/handle-payment', async (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;
    if (!tokenStore.has(sessionId)) {
      return res.status(403).send('Invalid session');
    }

    // 1. Получаем сохраненный токен
    const token = tokenStore.get(sessionId);
    
    // 2. Формируем данные для Payzaty
    const formData = new URLSearchParams();
    formData.append('__RequestVerificationToken', token);
    // Здесь должны быть все остальные поля формы
    
    // 3. Отправляем запрос в Payzaty с оригинальными заголовками
    const response = await axios.post(
      'https://www.payzaty.com/payment/process',
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': `__RequestVerificationToken=${token}`,
          'Origin': 'https://www.payzaty.com',
          'Referer': 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      }
    );

    // 4. Перенаправляем пользователя на следующий этап
    if (response.headers.location) {
      return res.redirect(`/payzaty${response.headers.location}`);
    }
    
    res.send(response.data);
  } catch (error) {
    console.error('Payment error:', error.response?.data || error.message);
    res.status(500).send('Payment processing failed');
  }
});

/**
 * Вспомогательные функции
 */
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Запуск сервера
 */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
