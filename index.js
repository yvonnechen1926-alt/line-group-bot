const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

app.post("/webhook", line.middleware(config), (req, res) => {
  console.log("收到事件：", JSON.stringify(req.body.events, null, 2));
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("LINE Bot is running");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});