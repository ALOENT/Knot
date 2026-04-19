'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '@/providers/SocketProvider';
import { api } from '@/lib/api';
import type { ChatUser } from '@/components/ChatList';
import type { Message } from '@/components/ChatWindow';
import { SOCKET_EVENTS } from '@/utils/socketEvents';

export interface AuthUser {
  id: string;
  username: string;
  displayName?: string;
  profilePic?: string;
  bio?: string;
  email?: string;
  role?: string;
  createdAt?: string;
  isOnline?: boolean;
  isVerified?: boolean;
  isBanned?: boolean;
}

interface ChatContextType {
  currentUser: AuthUser | null;
  authError: any;
  isLoadingAuth: boolean;
  activeChat: ChatUser | null;
  messages: Message[];
  setActiveChat: (user: ChatUser | null) => void;
  sendMessage: (
    content: string,
    fileUrl?: string,
    replyToId?: string,
    fileName?: string,
    attachmentBytes?: number,
    attachmentPages?: number,
  ) => void;
  isLoadingMessages: boolean;
  setCurrentUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
  deleteMessage: (messageId: string) => void;
  privacyModeEnabled: boolean;
  setPrivacyModeEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  blockedUsers: AuthUser[];
  blockedByIDs: string[];
  isBlocked: (userId: string) => boolean;
  isBlockedByMe: (userId: string) => boolean;
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
  setCurrentUser: () => {},
  deleteMessage: () => {},
  privacyModeEnabled: false,
  setPrivacyModeEnabled: () => {},
  blockedUsers: [],
  blockedByIDs: [],
  isBlocked: () => false,
  isBlockedByMe: () => false,
});

export const useChat = () => useContext(ChatContext);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket, joinChat } = useSocket();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeChat, setActiveChatState] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<AuthUser[]>([]);
  const [blockedByIDs, setBlockedByIDs] = useState<string[]>([]);
  const messagesAbortRef = useRef<AbortController | null>(null);
  const activeChatRef = useRef<ChatUser | null>(null);

  const [privacyModeEnabled, setPrivacyModeEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('knot_privacy');
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('knot_privacy', JSON.stringify(privacyModeEnabled));
    }
  }, [privacyModeEnabled]);

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
        
        // Fetch blocks after auth
        fetchBlocks();
      })
      .catch((err) => {
        console.error('[ChatProvider] Auth error:', err);
        setAuthError(err);
        setCurrentUser(null);
        setIsLoadingAuth(false);
      });
  }, []);

  const fetchBlocks = useCallback(async () => {
    try {
      const res = await api.get('/users/blocked');
      if (res.data.success) {
        setBlockedUsers(res.data.blockedUsers || []);
        setBlockedByIDs(res.data.blockedByIDs || []);
      }
    } catch (err) {
      console.error('[ChatProvider] Failed to fetch blocks:', err);
    }
  }, []);

  const isBlocked = useCallback((userId: string) => {
    const iBlocked = blockedUsers.some(u => u.id === userId);
    const theyBlocked = blockedByIDs.includes(userId);
    return iBlocked || theyBlocked;
  }, [blockedUsers, blockedByIDs]);

  const isBlockedByMe = useCallback((userId: string) => {
    return blockedUsers.some(u => u.id === userId);
  }, [blockedUsers]);

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
          // Match by same sender + same text/file + close timestamp
          const isSameSender = m.senderId === msg.senderId;
          const isSameContent = (m.content?.trim() || '') === (msg.content?.trim() || '');
          const isSameFile = (m.fileUrl || '') === (msg.fileUrl || '');
          const timeDiff = Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime());
          return isSameSender && isSameContent && isSameFile && timeDiff < 10000;
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
    
    const handleDelivered = (data: { messageId: string; receiverId: string }) => {
      setMessages((prev) => prev.map(m => m.id === data.messageId ? { ...m, status: 'DELIVERED' } : m));
    };

    const handleRead = (data: { readerId?: string, messageIds?: string[], partnerId?: string }) => {
      setMessages((prev) => {
        // 1. If we have specific message IDs, only update those
        if (data.messageIds && data.messageIds.length > 0) {
          return prev.map(m => data.messageIds!.includes(m.id) ? { ...m, status: 'READ' } : m);
        }
        
        // 2. Fallback to partner-based bulk update only when no specific IDs (older backend version compatibility)
        const partnerId = data.partnerId || data.readerId;
        if (partnerId) {
          return prev.map(m => (m.senderId === currentUser?.id && m.receiverId === partnerId && (m.status === 'SENT' || m.status === 'DELIVERED')) ? { ...m, status: 'READ' } : m);
        }
        
        return prev;
      });
    };

    const handleDeleted = (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId
            ? {
                ...m,
                isDeleted: true,
                content: 'This message was deleted',
                fileUrl: null,
                fileName: undefined,
                attachmentBytes: undefined,
                attachmentPages: undefined,
              }
            : m,
        ),
      );
    };

    socket.on('message_delivered', handleDelivered);
    socket.on('message_read', handleRead);
    socket.on('message_deleted', handleDeleted);

    return () => {
      socket.off('message_confirmed', handleConfirmed);
      socket.off('message_delivered', handleDelivered);
      socket.off('message_read', handleRead);
      socket.off('message_deleted', handleDeleted);
    };
  }, [socket, currentUser]);

  // ── 2. Handle Setting Active Chat & Fetching DB History ──
  const setActiveChat = useCallback(
    (user: ChatUser | null) => {
      if (currentUser?.isBanned) {
        console.warn('Action blocked: user is banned');
        return;
      }
      
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

      // Mark as read on the backend asynchronously
      api.put(`/messages/mark-read/${user.id}`).catch((err) => {
        console.error('[ChatProvider] Failed to mark as read:', err);
      });
      
      // FIX 1: Instantly emit message_read socket event so the sender sees live tick updates
      if (socket) {
        socket.emit('message_read', { senderId: user.id });
      }

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
    (
      content: string,
      fileUrl?: string,
      replyToId?: string,
      fileName?: string,
      attachmentBytes?: number,
      attachmentPages?: number,
    ) => {
      if (!socket || !activeChat || !currentUser) return;
      if (currentUser.isBanned) {
        console.warn('Action blocked: user is banned');
        return;
      }

      const bytes =
        typeof attachmentBytes === 'number' && Number.isFinite(attachmentBytes) && attachmentBytes >= 0
          ? Math.floor(attachmentBytes)
          : undefined;
      const pages =
        typeof attachmentPages === 'number' && Number.isFinite(attachmentPages) && attachmentPages > 0
          ? Math.floor(attachmentPages)
          : undefined;

      // Create optimistic message
      const optimisticMsg: Message = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        content,
        fileUrl,
        fileName: fileName?.trim() || undefined,
        attachmentBytes: bytes,
        attachmentPages: pages,
        senderId: currentUser.id,
        receiverId: activeChat.id,
        timestamp: new Date().toISOString(),
        status: 'SENT',
        replyToId,
        sender: {
          id: currentUser.id,
          username: currentUser.username,
          isVerified: currentUser.isVerified,
        },
      };

      // Push optimistically
      setMessages((prev) => [...prev, optimisticMsg]);

      // Emit to server
      socket.emit('send_message', {
        receiverId: activeChat.id,
        content,
        fileUrl,
        fileName: fileName?.trim() || undefined,
        attachmentBytes: bytes,
        attachmentPages: pages,
        replyToId,
      });
    },
    [socket, activeChat, currentUser]
  );

  // Delete Message function
  const deleteMessage = useCallback((messageId: string) => {
    if (!currentUser) return;
    if (currentUser.isBanned) {
      console.warn('Action blocked: user is banned');
      return;
    }

    // Capture the original state from the ref or let the rollback use a previous snapshot.
    // Rather than dealing with a ref, we can just grab it by setting state and returning, but to avoid race
    // conditions we'll pull the snapshot outside if possible. However, the best way in React is to just read
    // from the existing `messages` state in the dependency array (or using a ref). Let's use the local `messages` state.
    // Wait! `messages` is in the hook closure.
    const originalMessage = messages.find(m => m.id === messageId);
    if (!originalMessage) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              isDeleted: true,
              content: 'This message was deleted',
              fileUrl: null,
              fileName: undefined,
              attachmentBytes: undefined,
              attachmentPages: undefined,
            }
          : m,
      ),
    );
      
    // Verify by calling backend
    api.delete(`/messages/${messageId}`).catch(err => {
      console.error('Failed to delete message', err);
      // Rollback to original message
      setMessages(prev => prev.map(m => m.id === messageId ? originalMessage : m));
      alert('Failed to delete message.');
    });
  }, [currentUser, messages]);

  return (
    <ChatContext.Provider value={{ 
      currentUser, 
      setCurrentUser, 
      authError, 
      isLoadingAuth, 
      activeChat, 
      messages, 
      setActiveChat, 
      sendMessage, 
      isLoadingMessages, 
      deleteMessage, 
      privacyModeEnabled, 
      setPrivacyModeEnabled,
      blockedUsers,
      blockedByIDs,
      isBlocked,
      isBlockedByMe
    }}>
      {children}
    </ChatContext.Provider>
  );
};
