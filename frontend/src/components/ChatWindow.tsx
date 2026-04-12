'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Smile, Phone, Video, MoreVertical, ArrowLeft } from 'lucide-react';
import { useSocket } from '@/providers/SocketProvider';
import type { ChatUser } from '@/components/ChatList';

/* ════════════════════════════════════════════
   Types
   ════════════════════════════════════════════ */

export interface Message {
  id: string;
  content?: string | null;
  fileUrl?: string | null;
  senderId: string;
  receiverId: string;
  timestamp: string;
  sender?: {
    id: string;
    username: string;
    profilePic?: string | null;
  };
}

interface ChatWindowProps {
  activeUser: ChatUser | null;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
  onBack?: () => void;
}

/* ════════════════════════════════════════════
   Component
   ════════════════════════════════════════════ */

export default function ChatWindow({
  activeUser,
  messages,
  currentUserId,
  onSendMessage,
  onBack,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { onlineUsers, typingUsers, emitStartTyping, emitStopTyping } = useSocket();

  const isOnline = activeUser ? (onlineUsers.get(activeUser.id) ?? false) : false;
  const isTyping = activeUser ? (typingUsers.get(activeUser.id) ?? false) : false;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator emission
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (!activeUser) return;

      emitStartTyping(activeUser.id);

      // Clear existing timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      // Stop typing after 2s of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        emitStopTyping(activeUser.id);
      }, 2000);
    },
    [activeUser, emitStartTyping, emitStopTyping],
  );

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !activeUser) return;

    onSendMessage(trimmed);
    setInput('');

    // Stop typing on send
    emitStopTyping(activeUser.id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Empty state ──
  if (!activeUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/6 flex items-center justify-center">
            <Send className="h-8 w-8 text-indigo-400/40" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white/60">
              Select a conversation
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Choose a chat to start messaging
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Blurred translucent header ── */}
      <div className="glass-header px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile back button */}
          {onBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="md:hidden btn-icon h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
          )}

          {/* User info */}
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center border border-white/8">
              {activeUser.profilePic ? (
                <img
                  src={activeUser.profilePic}
                  alt={activeUser.username}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-white/80">
                  {activeUser.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div
              className={`absolute bottom-0 right-0 status-dot ${
                isOnline ? 'online' : 'offline'
              } border-2 border-[#0F0F12]`}
              style={{ width: 10, height: 10 }}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white leading-tight">
              {activeUser.username}
            </h3>
            <AnimatePresence mode="wait">
              {isTyping ? (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-1"
                >
                  <div className="typing-dots">
                    <span /><span /><span />
                  </div>
                  <span className="text-[11px] text-purple-400 font-medium">typing</span>
                </motion.div>
              ) : (
                <motion.span
                  key="status"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`text-[11px] ${isOnline ? 'text-green-400' : 'text-gray-500'}`}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="btn-icon h-9 w-9">
            <Phone className="h-4 w-4" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="btn-icon h-9 w-9">
            <Video className="h-4 w-4" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="btn-icon h-9 w-9">
            <MoreVertical className="h-4 w-4" />
          </motion.button>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isMine
                      ? 'bg-gradient-to-br from-indigo-500/90 to-purple-500/80 text-white rounded-br-md'
                      : 'bg-white/[0.06] text-white/90 border border-white/[0.06] rounded-bl-md'
                  }`}
                >
                  {msg.content && <p>{msg.content}</p>}
                  {msg.fileUrl && (
                    <img
                      src={msg.fileUrl}
                      alt="Attachment"
                      className="rounded-lg mt-1 max-h-60 object-cover"
                    />
                  )}
                  <span
                    className={`block text-[10px] mt-1.5 ${
                      isMine ? 'text-white/50 text-right' : 'text-gray-500'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* ── Message input bar ── */}
      <div className="shrink-0 px-5 pb-5 pt-2">
        <div className="flex items-end gap-2 glass-panel rounded-2xl px-3 py-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="btn-icon h-9 w-9 shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </motion.button>

          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-gray-500 py-2 focus:outline-none"
            style={{ maxHeight: '120px' }}
          />

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="btn-icon h-9 w-9 shrink-0"
          >
            <Smile className="h-4 w-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30"
            style={{
              background: input.trim()
                ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                : 'rgba(255,255,255,0.05)',
            }}
          >
            <Send className="h-4 w-4 text-white" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
