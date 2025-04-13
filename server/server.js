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
 *    - Переписывает домен в cookie на "my-app.example.com", чтобы браузер мог их принять
 *      (если ваш продакшен домен — my-app.example.com).
 *    - Устанавливает CORS-заголовок для загрузки ресурсов.
 */
app.use(
  '/payzaty',
  createProxyMiddleware({
    target: 'https://www.payzaty.com',
    changeOrigin: true,
    // Убираем префикс /payzaty, чтобы запросы шли по реальному пути на Payzaty.
    pathRewrite: { '^/payzaty': '' },
    // Переписываем домен куки на продакшен домен
    cookieDomainRewrite: 'my-app.example.com',
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
 *    - Загружает HTML-ответ с платежной страницы Payzaty.
 *    - Удаляет/скрывает сумму (элементы с классами .amount и .pay-amount).
 *    - Переписывает все относительные пути (href, src, action) так, чтобы они 
 *      указывали на /payzaty/... (то есть, чтобы запросы шли через наш прокси).
 */
app.get('/proxy-payzaty', async (req, res) => {
  try {
    const url = 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e';
    // Запрашиваем страницу с передачей cookie, если требуется
    const response = await axios.get(url, { withCredentials: true });
    let $ = cheerio.load(response.data);

    // Удаляем/прячем сумму
    $('.amount').text('');
    $('.pay-amount').text('');

    // Переписываем атрибуты href, src и action для всех элементов, начинающихся с "/"
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
