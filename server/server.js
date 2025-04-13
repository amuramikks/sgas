// server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

/**
 * Прокси-мидлварь для пути /payzaty:
 * - Проксирует все запросы (GET, POST и т.д.) на https://www.payzaty.com.
 * - Убирает префикс /payzaty, чтобы запрос шёл по реальному пути на Payzaty.
 * - Переписывает домен в cookie на нужный вам домен (например, "sgas-nlcb.onrender.com"),
 *   чтобы браузер корректно принимал cookie.
 * - Устанавливает CORS-заголовок для корректной загрузки ресурсов (шрифтов, CSS).
 */
app.use(
  '/payzaty',
  createProxyMiddleware({
    target: 'https://www.payzaty.com',
    changeOrigin: true,
    pathRewrite: { '^/payzaty': '' },
    // Если у вас есть собственный домен для бэкенда (например, когда вы настроили Custom Domain в Render),
    // замените 'sgas-nlcb.onrender.com' на него.
    cookieDomainRewrite: 'sgas-nlcb.onrender.com',
    onProxyRes(proxyRes) {
      // Устанавливаем заголовок для разрешения кросс-доступа
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      // Обработка Set-Cookie: убираем флаг Secure и устанавливаем SameSite=None
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
 * Эндпоинт /proxy-payzaty:
 * - Запрашивает HTML-страницу с платежной страницы Payzaty.
 * - Скрывает сумму (элементы с классами .amount и .pay-amount).
 * - Переписывает все относительные пути (href, src, action), чтобы они
 *   указывали на /payzaty/... (это нужно для корректного проксирования ресурсов).
 */
app.get('/proxy-payzaty', async (req, res) => {
  try {
    const url = 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e';
    const response = await axios.get(url, { withCredentials: true });
    const $ = cheerio.load(response.data);

    // Скрываем сумму
    $('.amount').text('');
    $('.pay-amount').text('');

    // Переписываем все относительные пути, чтобы они начинались с /payzaty
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
 * Используем переменную окружения PORT, которую предоставляет Render (или другая платформа).
 * Если PORT не задан (например, в локальной среде), будем слушать на 3001.
 * На продакшене SSL обеспечивается балансировщиком, поэтому достаточно обычного app.listen.
 */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Express сервер запущен на порту ${PORT}`);
});
