import type { SignalData } from 'simple-peer';
import { Server } from 'socket.io';
import { App } from 'uWebSockets.js';

import {
  CodeServiceMsg,
  PointerServiceMsg,
  RoomServiceMsg,
  ScrollServiceMsg,
  StreamServiceMsg,
} from '@codex/types/message';
import type { Cursor, EditOp } from '@codex/types/operation';
import type { Pointer } from '@codex/types/pointer';
import type { Scroll } from '@codex/types/scroll';
import type { ExecutionResult } from '@codex/types/terminal';

import * as codeService from '@/service/code-service';
import * as pointerService from '@/service/pointer-service';
import * as roomService from '@/service/room-service';
import * as scrollService from '@/service/scroll-service';
import * as userService from '@/service/user-service';
import * as webRTCService from '@/service/webrtc-service';

// ✅ ALLOWED_ORIGINS setup
const allowedOrigins = [
  'http://localhost:3000',
  'https://code-x-real-time-code-editor-with-v.vercel.app', // your Vercel frontend
];

// Helper to check allowed origins dynamically
const isAllowedOrigin = (origin?: string) =>
  !origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app');

// Use env PORT for Render/Heroku, fallback to 3001 locally
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const app = App();

const io = new Server({
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        console.warn(`❌ CORS blocked origin: ${origin}`);
        callback(new Error('Origin not allowed'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Attach Socket.IO to uWebSockets.js
io.attachApp(app);

// Root endpoint
app.get('/', (res, req) => {
  const origin = req.getHeader('origin');
  if (isAllowedOrigin(origin)) {
    res.writeHeader('Access-Control-Allow-Origin', origin || '*');
    res.writeHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.writeHeader('Content-Type', 'text/plain');
  res.end('Hello from codex-server!');
});

// Health check endpoint
app.get('/health', (res) => {
  res.writeHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ status: 'ok' }));
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on('ping', () => socket.emit('pong'));

  socket.on(RoomServiceMsg.CREATE, (name: string) =>
    roomService.create(socket, name)
  );
  socket.on(RoomServiceMsg.JOIN, (roomID: string, name: string) =>
    roomService.join(socket, io, roomID, name)
  );
  socket.on(RoomServiceMsg.LEAVE, () => roomService.leave(socket, io));
  socket.on(RoomServiceMsg.SYNC_USERS, () =>
    roomService.getUsersInRoom(socket, io)
  );
  socket.on(CodeServiceMsg.SYNC_CODE, () =>
    codeService.syncCode(socket, io)
  );
  socket.on(CodeServiceMsg.UPDATE_CODE, (op: EditOp) =>
    codeService.updateCode(socket, op)
  );
  socket.on(CodeServiceMsg.UPDATE_CURSOR, (cursor: Cursor) =>
    userService.updateCursor(socket, cursor)
  );
  socket.on(CodeServiceMsg.SYNC_LANG, () =>
    codeService.syncLang(socket, io)
  );
  socket.on(CodeServiceMsg.UPDATE_LANG, (langID: string) =>
    codeService.updateLang(socket, langID)
  );
  socket.on(ScrollServiceMsg.UPDATE_SCROLL, (scroll: Scroll) =>
    scrollService.updateScroll(socket, scroll)
  );
  socket.on(RoomServiceMsg.SYNC_MD, () => {
    roomService.syncNote(socket, io);
  });
  socket.on(RoomServiceMsg.UPDATE_MD, (note: string) =>
    roomService.updateNote(socket, note)
  );
  socket.on(CodeServiceMsg.EXEC, (isExecuting: boolean) =>
    roomService.updateExecuting(socket, isExecuting)
  );
  socket.on(CodeServiceMsg.UPDATE_TERM, (data: ExecutionResult) =>
    roomService.updateTerminal(socket, data)
  );
  socket.on(StreamServiceMsg.STREAM_READY, () =>
    webRTCService.onStreamReady(socket)
  );
  socket.on(StreamServiceMsg.SIGNAL, (signal: SignalData) =>
    webRTCService.handleSignal(socket, signal)
  );
  socket.on(StreamServiceMsg.CAMERA_OFF, () =>
    webRTCService.onCameraOff(socket)
  );
  socket.on(StreamServiceMsg.MIC_STATE, (micOn: boolean) =>
    webRTCService.handleMicState(socket, micOn)
  );
  socket.on(StreamServiceMsg.SPEAKER_STATE, (speakersOn: boolean) =>
    webRTCService.handleSpeakerState(socket, speakersOn)
  );
  socket.on(PointerServiceMsg.POINTER, (pointer: Pointer) =>
    pointerService.updatePointer(socket, pointer)
  );
  socket.on('disconnecting', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    roomService.leave(socket, io);
  });
});

app.listen(PORT, (token) => {
  if (!token) {
    console.error(`❌ Port ${PORT} is already in use`);
  }
  console.log(`🚀 codex-server listening on port: ${PORT}`);
});

