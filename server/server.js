// server.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const https = require('https');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

/**
 * 1) Прокси-мидлварь для пути /payzaty:
 *    - Проксирует все запросы (GET, POST и т.д.) на https://www.payzaty.com.
 *    - Убирает префикс /payzaty, чтобы запрос шел по реальному пути на Payzaty.
 *    - Переписывает домен в cookie на "my-backend.onrender.com" (замените на ваш реальный домен),
 *      чтобы браузер корректно принимал cookie.
 *    - Устанавливает CORS-заголовок для корректной загрузки ресурсов.
 */
app.use(
  '/payzaty',
  createProxyMiddleware({
    target: 'https://www.payzaty.com',
    changeOrigin: true,
    pathRewrite: { '^/payzaty': '' },
    cookieDomainRewrite: 'my-backend.onrender.com', // Замените на ваш реальный домен для бэкенда
    onProxyRes(proxyRes) {
      // Устанавливаем заголовок для разрешения кросс-доступа
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      // Если сервер возвращает Set-Cookie, обрабатываем куки: удаляем Secure и задаем SameSite=None
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
 *    - Загружает HTML-страницу с платежной страницы Payzaty.
 *    - Убирает (скрывает) сумму (элементы с классами .amount и .pay-amount).
 *    - Переписывает все относительные пути (href, src, action) так, чтобы они указывали на /payzaty/...
 *      (это нужно, чтобы все запросы к ресурсам шли через наш прокси).
 */
app.get('/proxy-payzaty', async (req, res) => {
  try {
    const url = 'https://www.payzaty.com/payment/pay/b30c92ee7a214814ad0bf43a72bf634e';
    // Делаем запрос к реальному сайту с передачей cookie, если требуется
    const response = await axios.get(url, { withCredentials: true });
    let $ = cheerio.load(response.data);

    // Скрываем сумму
    $('.amount').text('');
    $('.pay-amount').text('');

    // Переписываем все относительные ссылки, чтобы они начинались с /payzaty
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
 *    Файлы server.key и server.cert должны находиться в той же папке, что и этот файл.
 */
const httpsOptions = {
  key: fs.readFileSync('./server.key'),
  cert: fs.readFileSync('./server.cert')
};

/**
 * 4) Запуск HTTPS-сервера на порту 3001.
 *    Если вы деплоите на Render/Heroku, используйте app.listen(process.env.PORT || 3001)
 *    и удалите использование https.createServer, так как SSL будет обеспечен платформой.
 */
https.createServer(httpsOptions, app).listen(3001, () => {
  console.log('Express HTTPS-сервер запущен на порту 3001');
});
