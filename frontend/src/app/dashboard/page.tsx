'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatList from '@/components/ChatList';
import ChatWindow from '@/components/ChatWindow';
import { useSocket } from '@/providers/SocketProvider';
import { api } from '@/lib/api';
import type { ChatUser } from '@/components/ChatList';
import type { Message } from '@/components/ChatWindow';

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [activeChat, setActiveChat] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showChatList, setShowChatList] = useState(true);
  const { socket, joinChat } = useSocket();
  const messagesAbortRef = useRef<AbortController | null>(null);

  // ── Fetch current user ──
  useEffect(() => {
    api.get('/auth/me')
      .then((res) => setCurrentUser(res.data.user || res.data))
      .catch(() => {
        // Will be handled by api interceptor redirect
      });
  }, []);

  // ── Fetch chat users ──
  useEffect(() => {
    api.get('/users')
      .then((res) => setChatUsers(res.data.users || res.data || []))
      .catch(() => {});
  }, []);

  // ── Listen for new messages ──
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      if (activeChat && (msg.senderId === activeChat.id || msg.receiverId === activeChat.id)) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, activeChat]);

  // ── Select a chat ──
  const handleSelectChat = useCallback(
    (user: ChatUser) => {
      setActiveChat(user);
      setMessages([]);
      setShowChatList(false);
      joinChat(user.id);

      // Cancel any previous pending request
      if (messagesAbortRef.current) {
        messagesAbortRef.current.abort();
      }

      const abortController = new AbortController();
      messagesAbortRef.current = abortController;

      api.get(`/messages/${user.id}`, { signal: abortController.signal })
        .then((res) => {
          if (abortController.signal.aborted) return;
          setMessages(res.data.messages || []);
        })
        .catch((err) => {
          if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
          console.error('[Dashboard] Failed to fetch messages:', err);
          alert('Failed to load messages. Please try again.');
        });
    },
    [joinChat],
  );

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!socket || !activeChat) return;
      socket.emit('send_message', {
        receiverId: activeChat.id,
        content,
      });
    },
    [socket, activeChat],
  );

  const handleBack = useCallback(() => {
    setShowChatList(true);
    setActiveChat(null);
  }, []);

  return (
    <div className="flex h-full">
      {/* ── Chat List pane ── */}
      <div
        className={`h-full shrink-0 ${showChatList ? 'block' : 'hidden md:block'}`}
        style={{
          width: 'var(--chat-list-w)',
          borderRight: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <ChatList
          users={chatUsers}
          activeChatId={activeChat?.id ?? null}
          onSelectChat={handleSelectChat}
        />
      </div>

      {/* ── Chat Window pane ── */}
      <div className={`flex-1 h-full ${!showChatList ? 'block' : 'hidden md:block'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeChat?.id ?? 'empty'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <ChatWindow
              activeUser={activeChat}
              messages={messages}
              currentUserId={currentUser?.id ?? ''}
              onSendMessage={handleSendMessage}
              onBack={handleBack}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
