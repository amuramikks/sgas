// server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

/**
 * Прокси-миддлварь для пути /payzaty:
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
    // Укажите здесь ваш реальный домен на Render, если хотите переписывать куки
    // Пример: cookieDomainRewrite: 'sgas-nlcb.onrender.com'
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
 * Эндпоинт /proxy-payzaty:
 * - Запрашивает страницу оплаты Payzaty.
 * - Скрывает сумму (классы .amount, .pay-amount).
 * - Переписывает все относительные пути (href, src, action) на /payzaty/...
 *   для корректного проксирования.
 */
app.get('/proxy-payzaty', async (req, res) => {
  try {
    const url = 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e';
    const response = await axios.get(url, { withCredentials: true });
    const $ = cheerio.load(response.data);

    // Скрываем сумму
    $('.amount').text('');
    $('.pay-amount').text('');

    // Переписываем пути
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

    // Возвращаем модифицированный HTML
    res.send($.html());
  } catch (error) {
    console.error('Ошибка при загрузке Payzaty:', error);
    res.status(500).send('Error loading payment page');
  }
});

/**
 * Запуск сервера на порту, который предоставляет Render (или другой PaaS).
 * В локальной среде, если PORT не задан, будет 3001.
 */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Express сервер запущен на порту ${PORT}`);
});
