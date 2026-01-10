// 簡易 WebSocket プロキシ（本番ではエラーハンドリングや再接続対策を追加）
const http = require('http');
const WebSocket = require('ws');
const { ChatListener, getYouTubeLiveVideoId } = require('@letruxux/youtube-chat');

const PORT = process.env.PORT || 3000;
const VIDEO_ID = process.env.VIDEO_ID; // もしくはチャンネル名から解決する

const server = http.createServer((req, res) => {
  res.writeHead(200); res.end('ok');
});
const wss = new WebSocket.Server({ server });

let listener = null;

async function startListener(videoId) {
  if (!videoId) {
    console.error('no video id');
    return;
  }
  if (listener && listener.stop) listener.stop();

  listener = new ChatListener(videoId, {
    // オプション（必要なら）
  });

  listener.onMessage((msg) => {
    // msg の形式はパッケージの README に従う（author, text など）
    const payload = JSON.stringify({ type: 'chat', data: msg });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });

  listener.on('error', (err) => console.error('listener error', err));
  listener.start();
  console.log('chat listener started for', videoId);
}

wss.on('connection', (ws, req) => {
  console.log('client connected');
  ws.send(JSON.stringify({ type:'welcome', ts: Date.now() }));
  // もしまだ listener が動いていなければ起動（環境変数等を参照）
  // 実装により、videoId をクライアントから受け取る設計にしても良い
});

server.listen(PORT, async () => {
  console.log('server listening', PORT);
  // 簡単に VIDEO_ID がない場合のサンプル取得
  let vid = VIDEO_ID;
  if (!vid) {
    // 例: チャンネル名からライブ中の videoId を取得（getYouTubeLiveVideoId を利用）
    try {
      vid = await getYouTubeLiveVideoId('lofigirl'); // テスト用
    } catch (e) {
      console.warn('failed to get video id', e);
    }
  }
  if (vid) await startListener(vid);
});
