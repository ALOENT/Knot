'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus } from 'lucide-react';
import { useState } from 'react';
import { useSocket } from '@/providers/SocketProvider';

/* ════════════════════════════════════════════
   Types
   ════════════════════════════════════════════ */

export interface ChatUser {
  id: string;
  username: string;
  profilePic?: string | null;
  isOnline?: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

interface ChatListProps {
  users: ChatUser[];
  activeChatId: string | null;
  onSelectChat: (user: ChatUser) => void;
}

/* ════════════════════════════════════════════
   Component
   ════════════════════════════════════════════ */

export default function ChatList({ users, activeChatId, onSelectChat }: ChatListProps) {
  const [search, setSearch] = useState('');
  const { onlineUsers, typingUsers } = useSocket();

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold tracking-tight">Messages</h2>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            className="btn-icon h-9 w-9"
            title="New Chat"
          >
            <Plus className="h-4 w-4" />
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="chat-input pl-10 text-xs"
          />
        </div>
      </div>

      {/* ── Chat items ── */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        <AnimatePresence mode="popLayout">
          {filtered.map((user) => {
            const isActive = user.id === activeChatId;
            const isOnline = onlineUsers.get(user.id) ?? user.isOnline ?? false;
            const isTyping = typingUsers.get(user.id) ?? false;

            return (
              <motion.div
                key={user.id}
                layout
                layoutId={`chat-item-${user.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() => onSelectChat(user)}
                className={`chat-item flex items-center gap-3 ${isActive ? 'active' : ''}`}
              >
                {/* Avatar with online indicator */}
                <div className="relative shrink-0">
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center border border-white/8">
                    {user.profilePic ? (
                      <img
                        src={user.profilePic}
                        alt={user.username}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-white/80">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Status dot */}
                  <div
                    className={`absolute bottom-0 right-0 status-dot ${
                      isOnline ? 'online' : 'offline'
                    } border-2 border-[#0F0F12]`}
                    style={{ width: 12, height: 12 }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white truncate">
                      {user.username}
                    </span>
                    {user.lastMessageTime && (
                      <span className="text-[10px] text-gray-500 shrink-0 ml-2">
                        {user.lastMessageTime}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    {isTyping ? (
                      <div className="flex items-center gap-1.5">
                        <div className="typing-dots">
                          <span /><span /><span />
                        </div>
                        <span className="text-xs text-purple-400 font-medium">
                          typing
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 truncate">
                        {user.lastMessage || 'Start a conversation'}
                      </span>
                    )}
                    {user.unreadCount && user.unreadCount > 0 && (
                      <span className="shrink-0 ml-2 flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-500">
                        {user.unreadCount > 99 ? '99+' : user.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
