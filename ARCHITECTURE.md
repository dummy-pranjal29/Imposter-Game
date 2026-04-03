# Architecture & Scaling Strategy

## STEP 8: Scaling to Millions of Users

### Single-Server (Current)
In-memory Map stores all room state. Works for development and small deployments (thousands of rooms).

### Horizontal Scaling (Production)

#### Problem
Socket.IO rooms are local to each Node.js process.
Player A on Server 1 cannot receive events emitted to a room
where Player B is connected to Server 2.

#### Solution: Redis Adapter + Sticky Sessions

```
Load Balancer (sticky by socket ID or cookie)
      │
      ├── Node.js #1 ──┐
      ├── Node.js #2 ──┤── Redis Pub/Sub ── Socket.IO syncs room events
      └── Node.js #N ──┘

Game state (room data) ── Redis Hash (TTL = 2h)
```

**Enable in `.env`:**
```
USE_REDIS=true
REDIS_URL=redis://your-redis-cluster:6379
```

The `socketServer.ts` already conditionally attaches `@socket.io/redis-adapter`.

#### Game State in Redis (future step)
Currently game state lives in-memory on each server instance.
For true multi-server game state, replace the in-memory `rooms` Map in
`RoomManager` with Redis Hash operations:

```
HSET room:{roomId} phase DISCUSSION word Elephant imposterId user2
EXPIRE room:{roomId} 7200
```

Use optimistic locking (`WATCH` + `MULTI`/`EXEC`) for concurrent vote writes.

#### TURN Servers (WebRTC)
WebRTC P2P fails behind symmetric NAT (~15% of users) without TURN.
Add TURN servers to `webRTCService.ts`:

```ts
{ urls: 'turn:turn.yourdomain.com:3478', username: 'user', credential: 'pass' }
```

Use coturn (open source) or Twilio TURN / Cloudflare Calls.

#### Load Balancer Config (Nginx)
```nginx
upstream imposter_backend {
  ip_hash;  # sticky sessions
  server node1:3001;
  server node2:3001;
}
```

---

## STEP 9: Testing Strategy

### Unit Tests
- `GameEngine`: test each phase transition, vote tallying, tie handling
- `RoomManager`: addPlayer, markDisconnected, removePlayer, host re-assignment
- `words.ts`: ensure pickRandomWord returns valid words

### Integration Tests
- Socket.IO flow: join → start → word reveal → vote → result
- WebRTC signaling relay: offer → answer → ICE candidate routing
- Rate limiting: exceed chat limit → receive RATE_LIMITED error
- Reconnect flow: disconnect mid-game → rejoin → receive resync

### Edge Cases
- Room full (6th player attempt) → ROOM_FULL error
- Host disconnects → new host assigned automatically
- All players vote before timer → early resolution
- Tie vote → no elimination, imposter survives
- Player joins during active game → GAME_IN_PROGRESS error

---

## STEP 10: Production Hardening

### Deployment
```
server/   → Node.js container (Dockerfile below)
client/   → Static files (Vite build → CDN / Nginx)
```

**Server Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/dist ./dist
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Environment
- Never commit `.env` files (add to `.gitignore`)
- Use secrets manager (AWS Secrets Manager / Vault) for TURN credentials

### Monitoring
- Winston → CloudWatch / Datadog logs
- Health endpoint: `GET /health` for ALB health checks
- Socket.IO admin UI: `@socket.io/admin-ui` for connection monitoring
- Alert on: room count spikes, disconnect rates, error rates

### Security Checklist
- [x] Helmet.js security headers
- [x] CORS restricted to client origin
- [x] Rate limiting (HTTP + socket event level)
- [x] Input length limits (name: 20 chars, chat: 300 chars)
- [x] JSON body size limit (10kb)
- [x] Words never sent in broadcast events
- [x] userId derived server-side (never trusted from client)
- [x] Socket metadata validated on every event handler
- [ ] Add JWT auth for persistent user accounts (future)
- [ ] Add TURN credential rotation (future)
