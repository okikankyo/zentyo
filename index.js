const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const solarlunar = require('solarlunar');

console.log('🌙 LUNAR BOT START (CHANNEL VERSION)');

const app = express();
app.use(express.json());

const CLIENT_ID = process.env.LW_CLIENT_ID;
const CLIENT_SECRET = process.env.LW_CLIENT_SECRET;
const SERVICE_ACCOUNT = process.env.LW_SERVICE_ACCOUNT;
const PRIVATE_KEY = process.env.LW_PRIVATE_KEY;
const BOT_ID = process.env.LW_BOT_ID;

// =======================
// アクセストークン取得
// =======================
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  const privateKey = (PRIVATE_KEY || '')
    .replace(/^"(.*)"$/s, '$1')
    .replace(/\\n/g, '\n')
    .trim();

  const payload = {
    iss: CLIENT_ID,
    sub: SERVICE_ACCOUNT,
    iat: now,
    exp: now + 300
  };

  const assertion = jwt.sign(payload, privateKey, {
    algorithm: 'RS256'
  });

  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  params.append('client_id', CLIENT_ID);
  params.append('client_secret', CLIENT_SECRET);
  params.append('assertion', assertion);
  params.append('scope', 'bot.message');

  const response = await axios.post(
    'https://auth.worksmobile.com/oauth2/v2.0/token',
    params,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }
  );

  return response.data.access_token;
}

// =======================
// グループ送信（channelId）
// =======================
async function sendMessage(token, text) {
  const channelId = process.env.LW_TARGET_CHANNEL_ID;

  if (!channelId) {
    throw new Error('LW_TARGET_CHANNEL_ID が未設定です');
  }

  await axios.post(
    `https://www.worksapis.com/v1.0/bots/${BOT_ID}/channels/${channelId}/messages`,
    {
      content: {
        type: 'text',
        text
      }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('✅ グループ送信成功');
}

// =======================
// メッセージ作成
// =======================
function buildMessage(date, lunarDay) {
  let label = '';

  if (lunarDay === 1) label = '（新月）';
  if (lunarDay === 15) label = '（満月）';

  return `🌙旧暦カレンダーのお知らせ

2日後の ${date} は旧暦 ${lunarDay} 日 ${label} です。

ご確認よろしくお願いします。`;
}

// =======================
// Cron処理
// =======================
if (process.env.CRON === 'true') {
  (async () => {
    try {
      console.log('⏰ Cron実行');

      const now = new Date();

      // 2日後
      const target = new Date();
      target.setDate(now.getDate() + 2);

      const year = target.getFullYear();
      const month = target.getMonth() + 1;
      const day = target.getDate();

      // 旧暦変換
      const lunar = solarlunar.solar2lunar(year, month, day);

      console.log(`📅 対象日: ${year}-${month}-${day}`);
      console.log(`🌙 旧暦日: ${lunar.lDay}`);

      // 判定
      if (lunar.lDay !== 1 && lunar.lDay !== 15) {
        console.log('⏭ 条件外スキップ');
        process.exit(0);
      }

      console.log('🎯 送信条件一致');

      const token = await getAccessToken();

      const dateStr = `${year}/${month}/${day}`;

      await sendMessage(
        token,
        buildMessage(dateStr, lunar.lDay)
      );

      console.log('✅ Cron送信成功');
      process.exit(0);

    } catch (e) {
      console.error('❌ Cronエラー:', e.response?.data || e.message);
      process.exit(1);
    }
  })();
}

// =======================
// Web確認用
// =======================
app.get('/', (req, res) => {
  res.send('Lunar Bot Running');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server started on ${PORT}`);
});
