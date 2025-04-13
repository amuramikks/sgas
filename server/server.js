// server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const https = require('https');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

/**
 * 1) Прокси-мидлварь на /payzaty:
 *    - Проксирует запросы (GET, POST и т.д.) на https://www.payzaty.com
 *    - Переписывает домен в cookie (чтобы куки стали для "localhost"), 
 *      удаляет Secure и задаёт SameSite=None для локальной разработки.
 *    - Устанавливает CORS-заголовок, чтобы шрифты и картинки не блокировались.
 */
app.use(
  '/payzaty',
  createProxyMiddleware({
    target: 'https://www.payzaty.com',
    changeOrigin: true,
    // Убираем префикс /payzaty, чтобы запросы шли на реальный путь на Payzaty.
    pathRewrite: { '^/payzaty': '' },
    // Переписываем домен cookie на "localhost"
    cookieDomainRewrite: 'localhost',
    onProxyRes(proxyRes) {
      // Разрешаем кросс-доступ через CORS
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      // Если сервер отдаёт Set-Cookie, удаляем Secure и задаём SameSite=None
      if (proxyRes.headers['set-cookie']) {
        let newCookies = proxyRes.headers['set-cookie'].map((cookie) => {
          cookie = cookie.replace(/;\s*Secure/gi, '');
          cookie = cookie.replace(/;\s*SameSite=\w+/gi, '; SameSite=None');
          return cookie;
        });
        proxyRes.headers['set-cookie'] = newCookies;
      }
    },
  })
);

/**
 * 2) Эндпоинт /proxy-payzaty:
 *    - Загружает реальный HTML-ответ с платежной страницы Payzaty.
 *    - Убирает видимую сумму (элементы с классами .amount и .pay-amount).
 *    - Переписывает все относительные пути (href, src, action) так, чтобы они 
 *      указывали на /payzaty/..., что позволяет запросам (GET, POST) идти через наш proxy.
 */
app.get('/proxy-payzaty', async (req, res) => {
  try {
    const url = 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e';
    // При необходимости с передачей cookie
    const response = await axios.get(url, { withCredentials: true });
    let $ = cheerio.load(response.data);

    // Удаляем/прячем сумму.
    $('.amount').text('');
    $('.pay-amount').text('');

    // Переписываем атрибуты href, src и action для всех элементов, начинающихся с "/".
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
 * 3) Опции для HTTPS:
 *    Файлы server.key и server.cert должны находиться в этой же папке.
 */
const httpsOptions = {
  key: fs.readFileSync('./server.key'),
  cert: fs.readFileSync('./server.cert')
};

/**
 * 4) Запускаем HTTPS-сервер на порту 3001
 */
https.createServer(httpsOptions, app).listen(3001, () => {
  console.log('Express HTTPS-сервер запущен на порту 3001');
});
