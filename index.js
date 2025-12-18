const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

// -----------------
// 1️⃣ LINE Config
// -----------------
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

app.use(line.middleware(config));

// -----------------
// 2️⃣ 資料存放（簡單用記憶體）
// -----------------
let games = []; // 每個開局都是一個物件

const OPTIONS = [
  { id: "1", name: "1000/100" },
  { id: "2", name: "500/100" },
  { id: "3", name: "300/50" },
  { id: "4", name: "大老二" },
  { id: "5", name: "十三支" }
];

// -----------------
// 3️⃣ Webhook 入口
// -----------------
app.post("/webhook", async (req, res) => {
  try {
    const events = req.body.events;
    for (let event of events) {
      if (event.type === "message" && event.message.type === "text") {
        await handleText(event);
      } else if (event.type === "postback") {
        await handlePostback(event);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// -----------------
// 4️⃣ 處理文字訊息
// -----------------
async function handleText(event) {
  const userId = event.source.userId;
  const displayName = event.source.type === "group"
    ? event.source.groupId // 群組無法直接拿名稱
    : event.source.userId;

  const text = event.message.text.trim();

  // 開局指令
  if (text.startsWith("開局：")) {
    const dateTime = text.slice(3).trim(); // 去掉「開局：」
    createGame(event.replyToken, dateTime);
  }
}

// -----------------
// 5️⃣ 建立新局
// -----------------
async function createGame(replyToken, dateTime) {
  const gameId = Date.now().toString(); // 用時間戳做 id
  const game = {
    id: gameId,
    dateTime,
    players: {}, // 選項id => userId array
    finished: false
  };
  OPTIONS.forEach(o => {
    game.players[o.id] = [];
  });
  games.push(game);

  // 發送 Flex 按鈕
  const flexMsg = createFlexMessage(game);
  await client.replyMessage(replyToken, flexMsg);
}

// -----------------
// 6️⃣ Flex Message 建立
// -----------------
function createFlexMessage(game) {
  return {
    type: "flex",
    altText: `開局 ${game.dateTime}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: `開局通知`, weight: "bold", size: "lg" },
          { type: "text", text: `時間：${game.dateTime}`, margin: "md" },
          ...OPTIONS.map(o => ({
            type: "button",
            action: {
              type: "postback",
              label: `${o.name} +1`,
              data: JSON.stringify({ gameId: game.id, optionId: o.id })
            },
            style: "primary",
            color: "#1DB446",
            margin: "sm"
          }))
        ]
      }
    }
  };
}

// -----------------
// 7️⃣ 處理按鈕
// -----------------
const client = new line.Client(config);

async function handlePostback(event) {
  const userId = event.source.userId;
  const data = JSON.parse(event.postback.data);
  const game = games.find(g => g.id === data.gameId);
  if (!game || game.finished) return;

  const optionId = data.optionId;

  // 如果玩家已經在其他已成局選項，不能報
  for (let oid in game.players) {
    if (game.players[oid].includes(userId)) return;
  }

  game.players[optionId].push(userId);

  // 檢查是否成局
  if (game.players[optionId].length >= 4) {
    game.finished = true;
    // 移除成局玩家從其他選項
    for (let oid in game.players) {
      if (oid !== optionId) {
        game.players[oid] = game.players[oid].filter(u => !game.players[optionId].includes(u));
      }
    }

    // 回覆成局訊息
    const names = game.players[optionId].map(u => u).join("\n"); // 這裡簡單用 userId
    await client.pushMessage(event.source.groupId, {
      type: "text",
      text: 🎉【成局通知】\n${OPTIONS.find(o=>o.id===optionId).name} 已成局！\n玩家：\n${names}
    });
  } else {
    // 回覆更新 Flex Message（可選）
    await client.replyMessage(event.replyToken, createFlexMessage(game));
  }
}

// -----------------
// 8️⃣ 啟動
// -----------------
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});