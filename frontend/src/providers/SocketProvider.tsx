'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { io, Socket } from 'socket.io-client';

/* ════════════════════════════════════════════
   Types
   ════════════════════════════════════════════ */

interface PresenceData {
  userId: string;
  isOnline: boolean;
  lastSeen: string;
}

interface TypingData {
  userId: string;
  isTyping: boolean;
}

interface IncomingMessage {
  id: string;
  content?: string | null;
  senderId: string;
  receiverId: string;
  timestamp: string;
  sender?: {
    id: string;
    username: string;
    profilePic?: string | null;
  };
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  /** Map of userId → online status */
  onlineUsers: Map<string, boolean>;
  /** Map of userId → typing flag */
  typingUsers: Map<string, boolean>;
  /** Emit start typing for a specific target user */
  emitStartTyping: (targetUserId: string) => void;
  /** Emit stop typing for a specific target user */
  emitStopTyping: (targetUserId: string) => void;
  /** Join a chat room with a target user */
  joinChat: (targetUserId: string) => void;
  /** The most recently received incoming message (for sidebar sync) */
  lastReceivedMessage: IncomingMessage | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  onlineUsers: new Map(),
  typingUsers: new Map(),
  emitStartTyping: () => {},
  emitStopTyping: () => {},
  joinChat: () => {},
  lastReceivedMessage: null,
});

export const useSocket = () => useContext(SocketContext);

/* ════════════════════════════════════════════
   Provider
   ════════════════════════════════════════════ */

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, boolean>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Map<string, boolean>>(new Map());
  const [lastReceivedMessage, setLastReceivedMessage] = useState<IncomingMessage | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current) return;

    const socketInstance = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000',
      {
        withCredentials: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
        transports: ['websocket', 'polling'],
      },
    );

    // ── Connection lifecycle ──
    socketInstance.on('connect', () => {
      console.log('[Socket] Connected:', socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      setIsConnected(false);
    });

    // ── Presence updates ──
    socketInstance.on('presence_update', (data: PresenceData) => {
      setOnlineUsers((prev) => {
        const next = new Map(prev);
        next.set(data.userId, data.isOnline);
        return next;
      });
      // If user goes offline, make sure to clear them from typing list
      if (!data.isOnline) {
        setTypingUsers((prev) => {
          if (prev.has(data.userId)) {
            const next = new Map(prev);
            next.delete(data.userId);
            return next;
          }
          return prev;
        });
      }
    });

    // ── Typing indicators ──
    socketInstance.on('user_typing', (data: TypingData) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (data.isTyping) {
          next.set(data.userId, true);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    });

    // ── Incoming messages (for sidebar sync) ──
    socketInstance.on('new_message', (msg: IncomingMessage) => {
      setLastReceivedMessage(msg);
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  // ── Emit helpers ──
  const emitStartTyping = useCallback(
    (targetUserId: string) => {
      socketRef.current?.emit('start_typing', { targetUserId });
    },
    [],
  );

  const emitStopTyping = useCallback(
    (targetUserId: string) => {
      socketRef.current?.emit('stop_typing', { targetUserId });
    },
    [],
  );

  const joinChat = useCallback(
    (targetUserId: string) => {
      socketRef.current?.emit('join_chat', { targetUserId });
    },
    [],
  );

  const value = useMemo<SocketContextType>(
    () => ({
      socket,
      isConnected,
      onlineUsers,
      typingUsers,
      emitStartTyping,
      emitStopTyping,
      joinChat,
      lastReceivedMessage,
    }),
    [socket, isConnected, onlineUsers, typingUsers, emitStartTyping, emitStopTyping, joinChat, lastReceivedMessage],
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
