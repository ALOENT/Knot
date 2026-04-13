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
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const { onlineUsers, typingUsers } = useSocket();

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-white">Messages</h2>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="btn-icon h-7 w-7"
            title="New Chat"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </motion.button>
        </div>

        {/* Search — icon properly offset, text starts after icon */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#444] pointer-events-none z-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="chat-input text-xs"
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </div>

      {/* ── Chat items ── */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        <AnimatePresence mode="popLayout">
          {filtered.map((user) => {
            const isActive = user.id === activeChatId;
            const isOnline = onlineUsers.get(user.id) ?? user.isOnline ?? false;
            const isTyping = typingUsers.get(user.id) ?? false;

            return (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                role="button"
                tabIndex={0}
                aria-current={isActive ? 'true' : undefined}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectChat(user);
                  }
                }}
                onClick={() => onSelectChat(user)}
                className={`chat-item flex items-center gap-3 ${isActive ? 'active' : ''}`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    {user.profilePic && !imageErrors[user.id] ? (
                      <img
                        src={user.profilePic}
                        alt={user.username}
                        onError={() =>
                          setImageErrors((prev) => ({ ...prev, [user.id]: true }))
                        }
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-medium text-[#888]">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Status dot */}
                  <div
                    className={`absolute bottom-0 right-0 status-dot ${
                      isOnline ? 'online' : 'offline'
                    }`}
                    style={{
                      width: 8,
                      height: 8,
                      border: '1.5px solid #0a0a0a',
                    }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#e5e5e5] truncate">
                      {user.username}
                    </span>
                    {user.lastMessageTime && (
                      <span className="text-[10px] text-[#444] shrink-0 ml-2">
                        {user.lastMessageTime}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    {isTyping ? (
                      <div className="flex items-center gap-1">
                        <div className="typing-dots">
                          <span /><span /><span />
                        </div>
                        <span className="text-[11px] text-[#818cf8]">typing</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#555] truncate">
                        {user.lastMessage || 'Start a conversation'}
                      </span>
                    )}
                    {user.unreadCount && user.unreadCount > 0 && (
                      <span className="shrink-0 ml-2 flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9px] font-semibold text-white bg-[#6366f1]">
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
