'use client';
import { useEffect, useState, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import { useAuth } from '@/components/Auth/AuthContext';
import { resolveAccessToken } from '@/lib/auth-client';
import type { LiveChatMessage } from '@/types/live';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8100';
const MAX_MESSAGES = 200;

export function LiveChat({ sessionId }: { sessionId: string }) {
  const { token, isLoggedIn } = useAuth();
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let socket: Socket | null = null;

    void (async () => {
      const accessToken = token ?? await resolveAccessToken();
      if (!accessToken || cancelled) return;

      socket = io(GATEWAY, {
        path: '/api/v1/live/socket.io',
        auth: { token: accessToken },
        transports: ['websocket'],
      });
      socketRef.current = socket;
      socket.emit('join_stream', sessionId);
      socket.on('chat_message', (msg: LiveChatMessage) => {
        setMessages(prev => [...prev.slice(-(MAX_MESSAGES - 1)), msg]);
      });
      socket.on('error', (e: { code?: string }) => {
        if (e?.code === 'RATE_LIMITED') setRateLimited(true);
      });
    })();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    socketRef.current?.emit('chat_message', { sessionId, message: input });
    setInput('');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 500, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        Live Chat
      </Typography>
      <List dense sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {messages.map((m, i) => (
          <ListItem key={i} disableGutters sx={{ alignItems: 'flex-start' }}>
            <Typography variant="body2">
              <strong>{m.displayName}</strong>: {m.message}
            </Typography>
          </ListItem>
        ))}
        <div ref={bottomRef} />
      </List>
      {isLoggedIn ? (
        <Box sx={{ display: 'flex', p: 1, borderTop: 1, borderColor: 'divider', gap: 1 }}>
          <TextField
            size="small" fullWidth placeholder="Say something…"
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
          />
          <Button variant="contained" size="small" onClick={send}>Send</Button>
        </Box>
      ) : (
        <Typography variant="caption" sx={{ p: 1, borderTop: 1, borderColor: 'divider', color: 'text.secondary' }}>
          Log in to join the chat.
        </Typography>
      )}
      <Snackbar
        open={rateLimited}
        autoHideDuration={2000}
        onClose={() => setRateLimited(false)}
        message="Slow down — 1 message per second"
      />
    </Box>
  );
}
