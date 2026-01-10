import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || 'wss://your-proxy.example'); // ここを実際のエンドポイントに
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => console.log('ws open');
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'chat') {
          setMessages(prev => [...prev.slice(-199), msg.data]); // 最大200件保持
        }
      } catch (e) { console.error('parse err', e); }
    };
    ws.onclose = () => console.log('ws close');
    ws.onerror = (e) => console.error('ws err', e);

    return () => {
      ws.close();
    };
  }, []);

  return (
    <div style={{padding:20, fontFamily:'sans-serif'}}>
      <h1>YouTube Live Chat — リアルタイム表示</h1>
      <div style={{border:'1px solid #ddd', padding:10, height:500, overflowY:'auto', background:'#f9f9f9'}}>
        {messages.map((m, i) => (
          <div key={i} style={{padding:'6px 8px', borderBottom:'1px solid #eee'}}>
            <strong>{m.author?.name || m.author?.simpleText || 'Unknown'}</strong>
            <div>{m.text || m.message || m.snippet?.displayMessage}</div>
            <small style={{color:'#666'}}>{m.ts ? new Date(m.ts).toLocaleTimeString() : ''}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
