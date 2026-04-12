'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // ── Fetch current user ──
  useEffect(() => {
    api.get('/auth/me')
      .then((res) => setCurrentUser(res.data.user || res.data))
      .catch(() => {
        // Will be handled by api interceptor redirect
      });
  }, []);

  // ── Listen for new messages ──
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('new_message', handleNewMessage);
    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket]);

  // ── Select a chat ──
  const handleSelectChat = useCallback(
    (user: ChatUser) => {
      setActiveChat(user);
      setMessages([]); // Reset messages — fetch from API in real app
      setShowChatList(false); // Mobile: hide list, show chat
      joinChat(user.id);

      // Fetch message history
      api.get(`/messages/${user.id}`)
        .then((res) => setMessages(res.data.messages || []))
        .catch(() => {}); // Silently fail — real-time will catch up
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
      <motion.div
        className={`
          h-full border-r border-white/[0.04] shrink-0
          ${showChatList ? 'block' : 'hidden md:block'}
        `}
        style={{ width: 'var(--chat-list-w)' }}
      >
        <ChatList
          users={chatUsers}
          activeChatId={activeChat?.id ?? null}
          onSelectChat={handleSelectChat}
        />
      </motion.div>

      {/* ── Chat Window pane ── */}
      <div className={`flex-1 h-full ${!showChatList ? 'block' : 'hidden md:block'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeChat?.id ?? 'empty'}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
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
