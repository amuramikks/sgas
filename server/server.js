// server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const https = require('https');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

/**
 * Прокси-мидлварь для пути /payzaty:
 * - Проксирует запросы (GET, POST и т.д.) на https://www.payzaty.com.
 * - Убирает префикс /payzaty, чтобы запрос шёл по реальному пути на Payzaty.
 * - Переписывает домен в cookie на "my-backend.onrender.com" (замените на ваш реальный домен),
 *   чтобы браузер корректно принимал cookie.
 * - Устанавливает CORS-заголовок для корректной загрузки ресурсов.
 */
app.use(
  '/payzaty',
  createProxyMiddleware({
    target: 'https://www.payzaty.com',
    changeOrigin: true,
    pathRewrite: { '^/payzaty': '' },
    // Замените 'my-backend.onrender.com' на реальный домен вашего бэкенда (если он задан)
    cookieDomainRewrite: 'my-backend.onrender.com',
    onProxyRes(proxyRes) {
      // Разрешаем кросс-доступ
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      if (proxyRes.headers['set-cookie']) {
        // Убираем Secure и устанавливаем SameSite=None для всех cookie
        proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map((cookie) => {
          return cookie.replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=\w+/gi, '; SameSite=None');
        });
      }
    },
  })
);

/**
 * Эндпоинт /proxy-payzaty:
 * - Загружает HTML-страницу с платежной страницы Payzaty.
 * - Убирает (скрывает) сумму (элементы с классами .amount и .pay-amount).
 * - Переписывает все относительные пути (href, src, action), чтобы они
 *   указывали на /payzaty/... (чтобы все запросы шли через наш прокси).
 */
app.get('/proxy-payzaty', async (req, res) => {
  try {
    const url = 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e';
    const response = await axios.get(url, { withCredentials: true });
    let $ = cheerio.load(response.data);

    // Скрываем сумму
    $('.amount').text('');
    $('.pay-amount').text('');

    // Переписываем атрибуты href, src и action, чтобы они начинались с /payzaty
    $('[href^="/"]').each((_, el) => {
      const oldHref = $(el).attr('href');
      $(el).attr('href', '/payzaty' + oldHref);
    });
    $('[src^="/"]').each((_, el) => {
      const oldSrc = $(el).attr('src');
      $(el).attr('src', '/payzaty' + oldSrc);
    });
    $('[action^="/"]').each((_, el) => {
      const oldAction = $(el).attr('action');
      $(el).attr('action', '/payzaty' + oldAction);
    });

    res.send($.html());
  } catch (error) {
    console.error('Ошибка при загрузке Payzaty:', error);
    res.status(500).send('Error loading payment page');
  }
});

/**
 * Запуск сервера.
 *
 * Если переменная окружения PORT не определена (например, при локальном запуске),
 * используем HTTPS-сервер с локальными сертификатами (server.key, server.cert).
 *
 * Если PORT определен (на платформе Render/Heroku), запускаем обычный HTTP-сервер,
 * так как SSL-терминация обрабатывается платформой.
 */
const PORT = process.env.PORT || 3001;

if (!process.env.PORT) {
  // Локально: запускаем HTTPS-сервер
  const httpsOptions = {
    key: fs.readFileSync('./server.key'),
    cert: fs.readFileSync('./server.cert')
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Express HTTPS-сервер запущен на порту ${PORT}`);
  });
} else {
  // На платформе (Render, Heroku, Railway): слушаем HTTP, SSL обеспечивается балансировщиком
  app.listen(PORT, () => {
    console.log(`Express сервер запущен на порту ${PORT}`);
  });
}
