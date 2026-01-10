import { LiveChat } from "youtube-chat";
import WebSocket, { WebSocketServer } from "ws";
import { URL } from "url";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const wss = new WebSocketServer({ port: PORT });
console.log(`WebSocket server listening on :${PORT}`);

// helper: URL から YouTube の videoId / liveId を抜く
function extractVideoId(urlOrId) {
  try {
    // 直接IDが入っている場合もある
    if (/^[A-Za-z0-9_-]{10,}$/.test(urlOrId)) return urlOrId;
    const u = new URL(urlOrId);
    // /watch?v=xxxx
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    // /live/ID や /watch?v=... の代替
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1];
  } catch (e) {
    return urlOrId;
  }
}

// roomMap: videoId -> { listener: LiveChat, clients:Set<WebSocket>, watchers: number }
const roomMap = new Map();

async function startListening(videoId) {
  if (roomMap.has(videoId)) return roomMap.get(videoId);
  const lc = new LiveChat({ liveId: videoId });
  const clients = new Set();

  function broadcastChat(chat) {
    const payload = JSON.stringify({ type: "chat", data: {
      author: chat.author?.name || "",
      authorThumbnail: chat.author?.thumbnail?.url || "",
      message: chat.message?.map(m => m.text).join("") || "",
      timestamp: chat.timestamp || Date.now()
    }});
    for (const c of clients) {
      if (c.readyState === WebSocket.OPEN) c.send(payload);
    }
  }

  lc.on("chat", (item) => {
    // item は qiita の例と同様の構造
    try { broadcastChat(item); } catch (e) { console.error(e); }
  });

  lc.on("error", (err) => {
    console.error("LiveChat error:", err);
  });

  await lc.start(); // ライブラリの start を呼ぶ
  const room = { listener: lc, clients, watchers: 0 };
  roomMap.set(videoId, room);
  console.log(`Started LiveChat listener for ${videoId}`);
  return room;
}

async function stopListeningIfUnused(videoId) {
  const room = roomMap.get(videoId);
  if (!room) return;
  if (room.clients.size === 0) {
    try {
      if (room.listener && typeof room.listener.stop === "function") {
        await room.listener.stop();
      }
    } catch (e) { /* ignore */ }
    roomMap.delete(videoId);
    console.log(`Stopped LiveChat listener for ${videoId}`);
  }
}

wss.on("connection", (socket) => {
  console.log("client connected");
  socket.subscribedVideo = null;

  socket.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "subscribe" && msg.url) {
        const vid = extractVideoId(msg.url);
        // 既に別のビデオに登録していれば切る
        if (socket.subscribedVideo && socket.subscribedVideo !== vid) {
          const oldRoom = roomMap.get(socket.subscribedVideo);
          if (oldRoom) { oldRoom.clients.delete(socket); await stopListeningIfUnused(socket.subscribedVideo); }
        }
        socket.subscribedVideo = vid;
        const room = await startListening(vid);
        room.clients.add(socket);
        socket.send(JSON.stringify({type:"info", text:`subscribed to ${vid}`}));
      }
    } catch (e) {
      console.warn("failed to parse message", e);
    }
  });

  socket.on("close", async () => {
    console.log("client disconnected");
    const vid = socket.subscribedVideo;
    if (vid) {
      const room = roomMap.get(vid);
      if (room) {
        room.clients.delete(socket);
        await stopListeningIfUnused(vid);
      }
    }
  });
});
