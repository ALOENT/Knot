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
  role?: string;
  createdAt?: string;
  isOnline?: boolean;
}

interface ChatContextType {
  currentUser: AuthUser | null;
  authError: any;
  isLoadingAuth: boolean;
  activeChat: ChatUser | null;
  messages: Message[];
  setActiveChat: (user: ChatUser | null) => void;
  sendMessage: (content: string, fileUrl?: string) => void;
  isLoadingMessages: boolean;
}

const ChatContext = createContext<ChatContextType>({
  currentUser: null,
  authError: null,
  isLoadingAuth: true,
  activeChat: null,
  messages: [],
  setActiveChat: () => {},
  sendMessage: () => {},
  isLoadingMessages: false,
});

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket, joinChat } = useSocket();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeChat, setActiveChatState] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesAbortRef = useRef<AbortController | null>(null);
  const activeChatRef = useRef<ChatUser | null>(null);

  // Keep ref in sync with state for use in socket callbacks
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

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
        // Backend returns { success: true, data: { id, email, username, role, ... } }
        const userData = res.data.data || res.data.user || res.data;
        setCurrentUser(userData);
        setIsLoadingAuth(false);
      })
      .catch((err) => {
        console.error('[ChatProvider] Auth error:', err);
        setAuthError(err);
        setCurrentUser(null);
        setIsLoadingAuth(false);
      });
  }, []);

  // ── 1. Listen for incoming messages from OTHER users ──
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleNewMessage = (msg: Message) => {
      const chat = activeChatRef.current;

      // SENDER GUARD: If somehow the server echoes our own message, ignore it
      if (msg.senderId === currentUser.id) return;

      // Only append if the message belongs to the currently active conversation
      if (
        chat &&
        (msg.senderId === chat.id || msg.receiverId === chat.id)
      ) {
        setMessages((prev) => {
          // Deduplicate by ID
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, currentUser]);

  // ── 1b. Listen for message confirmations (replaces our optimistic messages) ──
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleConfirmed = (msg: Message) => {
      setMessages((prev) => {
        // Find the optimistic temp message and replace it with the real one
        const idx = prev.findIndex((m) => {
          if (m.id === msg.id) return true; // Already real, skip
          if (!m.id.startsWith('temp-')) return false;
          // Match by same sender + similar content + close timestamp
          const isSameSender = m.senderId === msg.senderId;
          const isSameContent = m.content?.trim() === msg.content?.trim();
          const timeDiff = Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime());
          return isSameSender && isSameContent && timeDiff < 10000;
        });

        if (idx !== -1) {
          const next = [...prev];
          next[idx] = msg;
          return next;
        }

        // If no optimistic match found, check if the message already exists
        if (prev.some((m) => m.id === msg.id)) return prev;

        // Append as new (edge case: optimistic was somehow lost)
        return [...prev, msg];
      });
    };

    socket.on('message_confirmed', handleConfirmed);
    return () => {
      socket.off('message_confirmed', handleConfirmed);
    };
  }, [socket, currentUser]);

  // ── 2. Handle Setting Active Chat & Fetching DB History ──
  const setActiveChat = useCallback(
    (user: ChatUser | null) => {
      setActiveChatState(user);
      
      if (!user) {
        setMessages([]);
        setIsLoadingMessages(false);
        return;
      }

      setMessages([]); // Clear while loading
      setIsLoadingMessages(true);
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
          setIsLoadingMessages(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
          console.error('[ChatProvider] Fetch messages error:', err);
          setIsLoadingMessages(false);
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
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    <ChatContext.Provider value={{ currentUser, authError, isLoadingAuth, activeChat, messages, setActiveChat, sendMessage, isLoadingMessages }}>
      {children}
    </ChatContext.Provider>
  );
};
