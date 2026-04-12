'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/providers/SocketProvider';
import { api } from '@/lib/api';
import type { ChatUser } from '@/components/ChatList';
import type { Message } from '@/components/ChatWindow';

export interface AuthUser {
  id: string;
  username: string;
  profilePic?: string;
  bio?: string;
  email?: string;
  createdAt?: string;
}

interface ChatContextType {
  currentUser: AuthUser | null;
  authError: any;
  isLoadingAuth: boolean;
  activeChat: ChatUser | null;
  messages: Message[];
  setActiveChat: (user: ChatUser | null) => void;
  sendMessage: (content: string, fileUrl?: string) => void;
}

const ChatContext = createContext<ChatContextType>({
  currentUser: null,
  authError: null,
  isLoadingAuth: true,
  activeChat: null,
  messages: [],
  setActiveChat: () => {},
  sendMessage: () => {},
});

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket, joinChat } = useSocket();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeChat, setActiveChatState] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesAbortRef = useRef<AbortController | null>(null);

  // Unmount cleanup for aborts
  useEffect(() => {
    return () => {
      if (messagesAbortRef.current) {
        messagesAbortRef.current.abort();
      }
    };
  }, []);

  // ── 0. Fetch Current User ──
  const [authError, setAuthError] = useState<any>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then((res) => {
        setCurrentUser(res.data.user || res.data);
        setIsLoadingAuth(false);
      })
      .catch((err) => {
        console.error('[ChatProvider] Auth error:', err);
        setAuthError(err);
        setCurrentUser(null);
        setIsLoadingAuth(false);
      });
  }, []);

  // ── 1. Listen for new incoming messages ──
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => {
        // If the message is already in the list (e.g., from optimistic update), we might want to replace it.
        // For simple zero-latency, we'll append, but check for duplicate IDs just in case.
        // Currently, optimistic messages might not have a real DB id initially, but let's assume we use temporary IDs.
        // If it's from the current chat context, append it.
        if (
          activeChat &&
          (msg.senderId === activeChat.id || msg.receiverId === activeChat.id)
        ) {
          const existingIndex = prev.findIndex((m) => {
            // Perfect ID match
            if (m.id === msg.id) return true;
            // Loose dedupe for optimistic messages
            if (m.id.startsWith('temp-') && m.senderId === msg.senderId) {
              const clientIdMatch = (m as any).clientId && (m as any).clientId === (msg as any).clientId;
              if (clientIdMatch) return true;

              const isSameContent = m.content?.trim() === msg.content?.trim();
              const timeDiff = Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime());
              return isSameContent && timeDiff < 5000; // 5-second window
            }
            return false;
          });

          if (existingIndex !== -1) {
            const next = [...prev];
            next[existingIndex] = msg; // Replace optimistic message with real message
            return next;
          }
          return [...prev, msg];
        }
        return prev;
      });
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, activeChat]);

  // ── 2. Handle Setting Active Chat & Fetching DB History ──
  const setActiveChat = useCallback(
    (user: ChatUser | null) => {
      setActiveChatState(user);
      
      if (!user) {
        setMessages([]);
        return;
      }

      setMessages([]); // Clear while loading
      joinChat(user.id);

      // Cancel pending fetches
      if (messagesAbortRef.current) {
        messagesAbortRef.current.abort();
      }
      const abortController = new AbortController();
      messagesAbortRef.current = abortController;

      api
        .get(`/messages/${user.id}`, { signal: abortController.signal })
        .then((res) => {
          if (abortController.signal.aborted) return;
          setMessages(res.data.messages || []);
        })
        .catch((err) => {
          if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
          console.error('[ChatProvider] Fetch messages error:', err);
        });
    },
    [joinChat]
  );

  // ── 3. Handle Sending Messages (Optimistic UI) ──
  const sendMessage = useCallback(
    (content: string, fileUrl?: string) => {
      if (!socket || !activeChat || !currentUser) return;

      // Create optimistic message
      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        content,
        fileUrl,
        senderId: currentUser.id,
        receiverId: activeChat.id,
        timestamp: new Date().toISOString(),
        sender: {
          id: currentUser.id,
          username: currentUser.username,
        },
      };

      // Push optimistically
      setMessages((prev) => [...prev, optimisticMsg]);

      // Emit to server
      socket.emit('send_message', {
        receiverId: activeChat.id,
        content,
        fileUrl,
      });
    },
    [socket, activeChat, currentUser]
  );

  return (
    <ChatContext.Provider value={{ currentUser, authError, isLoadingAuth, activeChat, messages, setActiveChat, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
};
