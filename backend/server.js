import express from 'express'
if (!liveMap.has(liveId)) {
// create a LiveChat instance
const lc = new LiveChat({ liveId })
lc.on('chat', (chatItem) => {
// normalize chatItem to only fields we need
const out = {
authorName: chatItem.authorName,
authorChannelId: chatItem.authorChannelId,
message: Array.isArray(chatItem.message) ? chatItem.message.map(m => (typeof m === 'string' ? m : m.text)).join('') : chatItem.message
}
broadcastToClients(liveId, { type: 'chat', payload: out })
})


lc.on('start', () => {
broadcastToClients(liveId, { type: 'info', message: `LiveChat polling started for ${liveId}` })
})


lc.on('error', (err) => {
broadcastToClients(liveId, { type: 'info', message: `LiveChat error for ${liveId}: ${err.message}` })
})


lc.listen().catch(err => console.error('listen error', err))
liveMap.set(liveId, { lc, clients: 1 })
} else {
const record = liveMap.get(liveId)
record.clients += 1
liveMap.set(liveId, record)
}
}
} catch (err) {
console.error('invalid message', err)
}
})


ws.on('close', () => {
const liveId = ws.subscribedLiveId
if (!liveId) return
const record = liveMap.get(liveId)
if (!record) return
record.clients -= 1
if (record.clients <= 0) {
// cleanup
try {
record.lc.stop && record.lc.stop()
} catch (e) {}
liveMap.delete(liveId)
} else {
liveMap.set(liveId, record)
}
})
})


const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
console.log('WebSocket server listening on', PORT)
})
