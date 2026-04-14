'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Smile, MoreVertical, ArrowLeft, X } from 'lucide-react';
import { useSocket } from '@/providers/SocketProvider';
import type { ChatUser } from '@/components/ChatList';
import dynamic from 'next/dynamic';

// Lazy-load emoji picker to avoid SSR issues and reduce initial bundle
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

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
  isLoadingMessages?: boolean;
}

/* ════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════ */

/** Regex that matches http/https URLs in message text */
const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;

/** Parses message text and turns URLs into clickable links */
function parseMessageContent(text: string): React.ReactNode {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex since we're using /g flag
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:opacity-80 transition-opacity"
          style={{ wordBreak: 'break-all' }}
        >
          {part}
        </a>
      );
    }
    // Reset regex lastIndex for next iteration
    URL_REGEX.lastIndex = 0;
    return part;
  });
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
  isLoadingMessages,
}: ChatWindowProps) {
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
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

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

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
    setSelectedFile(null);
    setShowEmojiPicker(false);

    emitStopTyping(activeUser.id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emojiData: any) => {
    setInput((prev) => prev + emojiData.emoji);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    // Reset input so selecting the same file works
    e.target.value = '';
  };

  const clearFile = () => {
    setSelectedFile(null);
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
              style={{ width: 8, height: 8, border: '1.5px solid #0a0a0a' }}
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

        {/* Actions — Calls removed, only more options */}
        <div className="flex items-center gap-0.5">
          <motion.button aria-label="More options" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} className="btn-icon h-8 w-8">
            <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
          </motion.button>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full px-4 py-4 space-y-2">
        {/* Loading skeleton while messages are being fetched */}
        {isLoadingMessages && messages.length === 0 && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`rounded-xl ${i % 2 === 0 ? 'bg-indigo-500/10' : 'bg-white/4'}`}
                  style={{ width: `${30 + ((i * 13) % 35)}%`, height: '42px' }}
                />
              </div>
            ))}
          </div>
        )}
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
                  className={`max-w-[85%] md:max-w-[70%] shrink break-words break-all rounded-xl px-3.5 py-2 text-[13px] leading-relaxed overflow-hidden ${
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
                  {msg.content && (
                    <p style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      {parseMessageContent(msg.content)}
                    </p>
                  )}
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

      {/* ── File preview bar ── */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 px-4"
          >
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-1"
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
              }}
            >
              <Paperclip className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span className="text-xs text-indigo-300 truncate flex-1">
                {selectedFile.name}
              </span>
              <span className="text-[10px] text-indigo-400/60 shrink-0">
                {(selectedFile.size / 1024).toFixed(0)}KB
              </span>
              <button
                onClick={clearFile}
                className="p-0.5 rounded hover:bg-white/5 transition-colors"
                aria-label="Remove file"
              >
                <X className="h-3 w-3 text-indigo-400" />
              </button>
            </div>
            <p className="text-[10px] text-[#555] mb-2 px-1">
              File upload backend coming soon — file name is shown as preview.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Message input bar ── */}
      <div className="shrink-0 px-4 pb-4 pt-2 relative">
        {/* Emoji Picker Floating Panel */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              ref={emojiPickerRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full right-4 mb-2 z-50"
            >
              <EmojiPicker
                onEmojiClick={handleEmojiSelect}
                width={320}
                height={380}
                skinTonesDisabled
                searchPlaceHolder="Search emoji..."
                previewConfig={{ showPreview: false }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
          />

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => fileInputRef.current?.click()}
            className="btn-icon h-8 w-8 shrink-0"
            aria-label="Attach file"
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
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`btn-icon h-8 w-8 shrink-0 ${showEmojiPicker ? 'active' : ''}`}
            aria-label="Emoji picker"
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
