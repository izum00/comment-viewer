import express from "express";
import { WebSocketServer } from "ws";
import { LiveChat } from "youtube-chat";

const app = express();
const PORT = process.env.PORT || 3000;

// HTMLを返す（ルートは必ずHTML）
app.use(express.static("public"));

const server = app.listen(PORT, () => {
  console.log("Server started on", PORT);
});

// WebSocket (Renderでは自動的にwssになる)
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("WebSocket connected");

  let chat;

  ws.on("message", async (msg) => {
    const data = JSON.parse(msg.toString());

    if (data.type === "connect") {
      // YouTube Live URL から chatId を自動取得
      chat = new LiveChat({ liveId: data.liveId });

      chat.on("chat", (chatItem) => {
        ws.send(
          JSON.stringify({
            type: "chat",
            author: chatItem.author.name,
            message: chatItem.message,
          })
        );
      });

      chat.on("error", (err) => {
        ws.send(JSON.stringify({ type: "error", message: err.message }));
      });

      chat.start();
    }

    if (data.type === "disconnect" && chat) {
      chat.stop();
    }
  });

  ws.on("close", () => {
    if (chat) chat.stop();
  });
});
