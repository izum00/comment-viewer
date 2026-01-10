// server.js (ESM)
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { Innertube } from "youtubei.js";

const app = express();
app.use(express.static("public")); // public/index.html をルートに置く

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

(async () => {
  // Innertube のインスタンスは一つ作って使い回す（コスト低）
  const youtube = await Innertube.create(); // もしくは: const youtube = new Innertube();

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("WS connected");
    let livechat = null;

    // 安全な JSON シリアライザ（循環参照を避ける）
    const safeStringify = (obj) => {
      const seen = new WeakSet();
      return JSON.stringify(obj, function (k, v) {
        if (typeof v === "object" && v !== null) {
          if (seen.has(v)) return "[Circular]";
          seen.add(v);
        }
        // 関数や大きすぎるオブジェクトは省略
        if (typeof v === "function") return "[Function]";
        return v;
      });
    };

    ws.on("message", async (msg) => {
      try {
        const data = JSON.parse(msg.toString());

        if (data.type === "connect") {
          const videoId = data.videoId; // クライアントから videoId を受け取る
          if (!videoId) {
            ws.send(JSON.stringify({ type: "error", message: "videoId required" }));
            return;
          }

          try {
            // video の info を取得して LiveChat を取る
            const info = await youtube.getInfo(videoId);
            // getLivechat / getLiveChat のどちらかの名前で実装差があることがあるので両方試す
            livechat = (info.getLivechat && info.getLivechat()) || (info.getLiveChat && info.getLiveChat()) || null;

            if (!livechat) {
              ws.send(JSON.stringify({ type: "error", message: "No live chat available for this video (not live or not found)." }));
              return;
            }

            // イベント登録
            livechat.on("start", (initial) => {
              ws.send(JSON.stringify({ type: "meta", message: "livechat started", initial: safeStringify(initial) }));
            });

            livechat.on("metadata-update", (m) => {
              ws.send(JSON.stringify({ type: "meta-update", payload: safeStringify(m) }));
            });

            livechat.on("error", (err) => {
              ws.send(JSON.stringify({ type: "error", message: err?.message || String(err) }));
            });

            livechat.on("end", () => {
              ws.send(JSON.stringify({ type: "end", message: "Live stream ended" }));
            });

            // 新規チャットイベント（詳細オブジェクトは大きく複雑な場合があるので safeStringify して送る）
            livechat.on("chat-update", (action) => {
              try {
                // ここはライブラリ内部のオブジェクト構造に依存するため、まずは raw を stringify で送る（クライアントで表示しやすくする）
                ws.send(JSON.stringify({ type: "chat", payload: safeStringify(action) }));
              } catch (e) {
                ws.send(JSON.stringify({ type: "chat", payload: "[unserializable action]" }));
              }
            });

            // 開始（内部で定期ポーリングなどを始める）
            if (typeof livechat.start === "function") livechat.start();
            ws.send(JSON.stringify({ type: "ok", message: "connected to live chat" }));
          } catch (err) {
            ws.send(JSON.stringify({ type: "error", message: err?.message || String(err) }));
          }
        }

        if (data.type === "disconnect" && livechat) {
          if (typeof livechat.stop === "function") livechat.stop();
          livechat = null;
          ws.send(JSON.stringify({ type: "ok", message: "disconnected" }));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: "error", message: "invalid message" }));
      }
    });

    ws.on("close", () => {
      if (livechat && typeof livechat.stop === "function") livechat.stop();
    });
  });

  server.listen(PORT, () => console.log(`Listening on ${PORT}`));
})();
