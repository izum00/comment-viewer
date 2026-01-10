// server.js
if(data.action === 'connect'){
const videoId = extractVideoId(data.url);
if(!videoId){ ws.send(JSON.stringify({type:'system', text:'video id を解析できませんでした'})); return; }


// 既にインスタンスがあるか
let room = rooms.get(videoId);
if(!room){
const liveChat = new LiveChat({ liveId: videoId });
const clients = new Set();
room = { liveChat, clients };
rooms.set(videoId, room);


liveChat.on('chat', (chat)=>{
// youtube-chat のイベント名はバージョンに依存するため適宜調整
const payload = { type:'message', id: chat.id, message: chat.message, author: { name: chat.author?.name } };
for(const c of clients){ if(c.readyState === c.OPEN) c.send(JSON.stringify(payload)); }
});


liveChat.on('error', (err)=>{
for(const c of clients){ if(c.readyState === c.OPEN) c.send(JSON.stringify({type:'system', text:'ライブチャット取得エラー'})); }
});


try{ await liveChat.start(); }catch(e){
// start が無いライブラリもあるため例外処理
console.warn('liveChat.start() failed or not required', e);
}
}


room.clients.add(ws);
ws._subscribedVideo = videoId;
ws.send(JSON.stringify({type:'system', text:'接続済み: '+videoId}));
}
});


ws.on('close', ()=>{
const videoId = ws._subscribedVideo;
if(videoId){
const room = rooms.get(videoId);
if(room){ room.clients.delete(ws); if(room.clients.size===0){
// 必要なら liveChat.stop() でクリーンアップ
try{ room.liveChat.stop?.(); }catch(e){}
rooms.delete(videoId);
}}
}
});
});


// keepalive
setInterval(()=>{
wss.clients.forEach((ws)=>{ if(ws.isAlive===false) return ws.terminate(); ws.isAlive=false; ws.ping(); });
},30000);


server.listen(port, ()=> console.log('ws server listening', port));
