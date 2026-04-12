'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatList from '@/components/ChatList';
import ChatWindow from '@/components/ChatWindow';
import { useChat } from '@/providers/ChatProvider';
import { api } from '@/lib/api';
import type { ChatUser } from '@/components/ChatList';

export default function DashboardPage() {
  const { currentUser, activeChat, messages, setActiveChat, sendMessage } = useChat();
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [showChatList, setShowChatList] = useState(true);

  // ── Fetch chat users ──
  useEffect(() => {
    api.get('/users')
      .then((res) => setChatUsers(res.data.users || res.data || []))
      .catch(() => {});
  }, []);

  // ── Select a chat ──
  const handleSelectChat = useCallback(
    (user: ChatUser) => {
      setActiveChat(user);
      setShowChatList(false);
    },
    [setActiveChat],
  );

  const handleBack = useCallback(() => {
    setShowChatList(true);
    setActiveChat(null);
  }, [setActiveChat]);

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
              onSendMessage={sendMessage}
              onBack={handleBack}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
