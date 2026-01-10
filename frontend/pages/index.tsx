import React, { useEffect, useRef, useState } from 'react'


export default function Home() {
const [url, setUrl] = useState('')
const [connected, setConnected] = useState(false)
const [logs, setLogs] = useState<any[]>([])
const wsRef = useRef<WebSocket | null>(null)
const [status, setStatus] = useState('disconnected')


const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://your-ws-server.example.com'


function parseLiveIdFromUrl(u: string) {
try {
const parsed = new URL(u)
// common YouTube live URL patterns
// https://www.youtube.com/watch?v=LIVEID
// https://youtu.be/LIVEID
// https://www.youtube.com/watch?v=LIVEID&... -> search param 'v'
if (parsed.hostname.includes('youtu')) {
const v = parsed.searchParams.get('v')
if (v) return v
// path like /watch?v= or /live/.. or short youtu.be
const pathParts = parsed.pathname.split('/').filter(Boolean)
return pathParts[pathParts.length - 1]
}
} catch (e) {
return null
}
return null
}


const connect = () => {
const liveId = parseLiveIdFromUrl(url)
if (!liveId) {
alert('YouTubeのライブURLを正しく入力してください。')
return
}


if (wsRef.current) {
wsRef.current.close()
wsRef.current = null
}


const ws = new WebSocket(WS_URL)
wsRef.current = ws
setStatus('connecting')


ws.onopen = () => {
setConnected(true)
setStatus('connected')
// tell backend which liveId we want
ws.send(JSON.stringify({ type: 'start', liveId }))
}
}
