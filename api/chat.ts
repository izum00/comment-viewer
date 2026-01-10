import type { VercelRequest, VercelResponse } from "@vercel/node";
import { LiveChat } from "youtube-chat";

let liveChat: LiveChat | null = null;
let messages: any[] = [];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { liveId } = req.query;

  if (!liveId || typeof liveId !== "string") {
    return res.status(400).json({ error: "liveId is required" });
  }

  // 初回だけ接続
  if (!liveChat) {
    messages = [];
    liveChat = new LiveChat({ liveId });

    liveChat.on("chat", (chatItem) => {
      const text = chatItem.message.map((m) => m.text).join("");
      messages.push({
        author: chatItem.author.name,
        message: text,
      });

      // メモリ肥大防止
      if (messages.length > 100) {
        messages.shift();
      }
    });

    liveChat.on("error", (err) => {
      console.error(err);
    });

    liveChat.start();
  }

  // 3秒ごとにFetchされる想定
  res.status(200).json(messages);
}
