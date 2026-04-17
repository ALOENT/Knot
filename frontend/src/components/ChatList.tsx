'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, BadgeCheck } from 'lucide-react';
import { useState } from 'react';
import { useSocket } from '@/providers/SocketProvider';

/* ════════════════════════════════════════════
   Types
   ════════════════════════════════════════════ */

export interface ChatUser {
  id: string;
  username: string;
  displayName?: string | null;
  profilePic?: string | null;
  isOnline?: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  isVerified?: boolean;
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

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const name = u.displayName || u.username;
    return name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

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
      <div className="flex-1 overflow-y-auto px-2 pb-20 md:pb-4 space-y-1">
        <AnimatePresence mode="popLayout">
          {filtered.map((user) => {
            const isActive = user.id === activeChatId;
            const isOnline = onlineUsers.get(user.id) ?? user.isOnline ?? false;
            const isTyping = typingUsers.get(user.id) ?? false;

            return (
              <motion.div
                key={user.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
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
                className={`chat-item group flex items-center gap-4 py-3.5 px-3 rounded-2xl cursor-pointer select-none transition-all duration-200 active:scale-[0.98] ${
                  isActive ? 'bg-blue-600/10 border-blue-500/20' : 'hover:bg-white/5 border-transparent'
                } border`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                      isActive ? 'rotate-3 scale-110 shadow-lg shadow-blue-500/10' : ''
                    }`}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    {user.profilePic && !imageErrors[user.id] ? (
                      <img
                        src={user.profilePic}
                        alt={user.displayName || user.username}
                        onError={() =>
                          setImageErrors((prev) => ({ ...prev, [user.id]: true }))
                        }
                        className="h-full w-full rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="text-sm font-bold text-gray-500">
                        {(user.displayName || user.username).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Status dot */}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 status-dot ${isOnline ? 'online' : 'offline'}`}
                    style={{
                      width: 10,
                      height: 10,
                      border: '2px solid var(--dashboard-bg, #0a0a0c)',
                    }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[15px] font-semibold text-gray-100 flex items-center min-w-0">
                      <span className="truncate">{user.displayName || user.username}</span>
                      {user.isVerified && (
                        <BadgeCheck className="w-4 h-4 text-blue-500 ml-1.5 shrink-0" role="img" aria-label="Verified user" />
                      )}
                    </span>
                    {user.lastMessageTime && (
                      <span className="text-[11px] text-gray-500 shrink-0 ml-2 font-medium">
                        {user.lastMessageTime}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    {isTyping ? (
                      <div className="flex items-center gap-1.5">
                        <div className="typing-dots">
                          <span /><span /><span />
                        </div>
                        <span className="text-[11px] text-indigo-400 font-medium">typing</span>
                      </div>
                    ) : (
                      <span className="text-[13px] text-gray-400/80 truncate leading-relaxed">
                        {user.lastMessage || 'Start a conversation'}
                      </span>
                    )}
                    {(user.unreadCount ?? 0) > 0 && (
                      <motion.span 
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        className="shrink-0 ml-2 flex items-center justify-center h-[18px] min-w-[18px] px-1 bg-blue-600 rounded-full text-[10px] font-bold text-white shadow-lg shadow-blue-600/20"
                      >
                        {user.unreadCount! > 99 ? '99+' : user.unreadCount}
                      </motion.span>
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
