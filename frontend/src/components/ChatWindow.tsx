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

  // Cleanup typing timeout when unmounting or active user changes
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (activeUser) {
        emitStopTyping(activeUser.id);
      }
    };
  }, [activeUser, emitStopTyping]);

  // Handle typing indicator emission
  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (!activeUser) return;

      emitStartTyping(activeUser.id);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

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
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <div
            className="mx-auto h-14 w-14 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <Send className="h-6 w-6 text-[#888]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[#aaa]">
              Select a conversation
            </h3>
            <p className="text-xs text-[#888] mt-1">
              Choose a chat to start messaging
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="glass-header px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile back button */}
          {onBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="md:hidden btn-icon h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </motion.button>
          )}

          {/* User info */}
          <div className="relative">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {activeUser.profilePic ? (
                <img
                  src={activeUser.profilePic}
                  alt={activeUser.username}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-medium text-[#888]">
                  {activeUser.username.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 status-dot ${
                isOnline ? 'online' : 'offline'
              }`}
              style={{ width: 8, height: 8, border: '1.5px solid #030303' }}
            />
          </div>

          <div>
            <h3 className="text-sm font-medium text-white leading-tight">
              {activeUser.username}
            </h3>
            <AnimatePresence mode="wait">
              {isTyping ? (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1"
                >
                  <div className="typing-dots">
                    <span /><span /><span />
                  </div>
                  <span className="text-[10px] text-[#818cf8]">typing</span>
                </motion.div>
              ) : (
                <motion.span
                  key="status"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`text-[10px] ${isOnline ? 'text-green-500' : 'text-[#444]'}`}
                >
                  {isOnline ? 'Online' : 'Offline'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          <motion.button aria-label="Start phone call" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} className="btn-icon h-8 w-8">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          </motion.button>
          <motion.button aria-label="Start video call" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} className="btn-icon h-8 w-8">
            <Video className="h-3.5 w-3.5" aria-hidden="true" />
          </motion.button>
          <motion.button aria-label="More options" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} className="btn-icon h-8 w-8">
            <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
          </motion.button>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] md:max-w-[55%] rounded-xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    isMine
                      ? 'bg-[#6366f1] text-white rounded-br-sm'
                      : 'text-[#ccc] rounded-bl-sm'
                  }`}
                  style={
                    !isMine
                      ? {
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.04)',
                        }
                      : undefined
                  }
                >
                  {msg.content && <p>{msg.content}</p>}
                  {msg.fileUrl && (
                    <img
                      src={msg.fileUrl}
                      alt="Attachment"
                      className="rounded-lg mt-1 max-h-48 object-cover"
                    />
                  )}
                  <span
                    className={`block text-[9px] mt-1 ${
                      isMine ? 'text-white/40 text-right' : 'text-[#444]'
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
      <div className="shrink-0 px-4 pb-4 pt-2">
        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="btn-icon h-8 w-8 shrink-0"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </motion.button>

          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-[#444] py-1.5 focus:outline-none"
            style={{ maxHeight: '100px' }}
          />

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="btn-icon h-8 w-8 shrink-0"
          >
            <Smile className="h-3.5 w-3.5" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={!input.trim()}
            className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-150 disabled:opacity-20"
            style={{
              background: input.trim()
                ? '#6366f1'
                : 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <Send className="h-3.5 w-3.5 text-white" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
