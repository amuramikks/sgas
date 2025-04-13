const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

/**
 * Прокси-мидлварь для пути /payzaty:
 * - Проксирует все запросы (GET, POST и т.д.) на https://www.payzaty.com.
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
    // Замените 'my-backend.onrender.com' на реальный домен вашего бэкенда, если он есть
    cookieDomainRewrite: 'my-backend.onrender.com',
    onProxyRes(proxyRes) {
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      if (proxyRes.headers['set-cookie']) {
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
 *   указывали на /payzaty/...
 */
app.get('/proxy-payzaty', async (req, res) => {
  try {
    const url = 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e';
    const response = await axios.get(url, { withCredentials: true });
    let $ = cheerio.load(response.data);

    $('.amount').text('');
    $('.pay-amount').text('');

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
 * Используем PORT из переменной окружения, чтобы платформы типа Render могли пробросить трафик.
 * На продакшене SSL обеспечивается балансировщиком платформы, поэтому не используем https.createServer.
 */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Express сервер запущен на порту ${PORT}`);
});
