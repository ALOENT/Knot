'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Smile, MoreVertical, ArrowLeft, X, BadgeCheck, Flag } from 'lucide-react';
import { useSocket } from '@/providers/SocketProvider';
import { api } from '@/lib/api';
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
    displayName?: string | null;
    profilePic?: string | null;
    isVerified?: boolean;
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
  const menuRef = useRef<HTMLDivElement>(null);
  const { onlineUsers, typingUsers, emitStartTyping, emitStopTyping } = useSocket();

  // Reporting State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isOnline = activeUser ? (onlineUsers.get(activeUser.id) ?? false) : false;
  const isTyping = activeUser ? (typingUsers.get(activeUser.id) ?? false) : false;

  const handleSendReport = async () => {
    if (!activeUser || !reportReason) return;
    try {
      setIsSubmittingReport(true);
      const res = await api.post('/reports', {
        reportedUserId: activeUser.id,
        reason: reportReason
      });
      
      if (res.data.success) {
        setIsReportModalOpen(false);
        setReportReason('');
        alert('User has been reported. Admins will review the context.');
      } else {
        alert(res.data.message || 'Failed to submit report. Please try again.');
      }
    } catch (error: any) {
      console.error('Failed to report user', error);
      alert(error.response?.data?.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

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

  // Close emoji picker and menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Escape to close menus
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setShowEmojiPicker(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

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
        <div className="text-center space-y-4">
          <div
            className="mx-auto h-20 w-20 rounded-3xl flex items-center justify-center bg-indigo-500/5 border border-indigo-500/10"
          >
            <Send className="h-8 w-8 text-indigo-500/40" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-200">
              Select a conversation
            </h3>
            <p className="text-sm text-gray-500 mt-1 max-w-[200px] mx-auto">
              Choose a contact from the list to start messaging
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c]">

      {/* ── Header ── */}
      <div className="glass-header px-4 py-3 flex items-center justify-between shrink-0 h-[64px] z-30">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile back button - Only visible on sm screens */}
          {onBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="md:hidden flex items-center justify-center h-10 w-10 -ml-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
          )}

          {/* User info */}
          <div className="relative shrink-0">
            <div
              className="h-10 w-10 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {activeUser.profilePic ? (
                <img
                  src={activeUser.profilePic}
                  alt={activeUser.displayName || activeUser.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-gray-500">
                  {(activeUser.displayName || activeUser.username).charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 status-dot ${
                isOnline ? 'online' : 'offline'
              }`}
              style={{ width: 10, height: 10, border: '2px solid #0a0a0c' }}
            />
          </div>

          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-white leading-none flex items-center mb-1">
              <span className="truncate">{activeUser.displayName || activeUser.username}</span>
              {activeUser.isVerified && (
                <BadgeCheck className="w-4 h-4 text-blue-500 ml-1.5 shrink-0" />
              )}
            </h3>
            <AnimatePresence mode="wait">
              {isTyping ? (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <div className="typing-dots">
                    <span /><span /><span />
                  </div>
                  <span className="text-[10px] text-indigo-400 font-bold tracking-tight uppercase">typing</span>
                </motion.div>
              ) : (
                <motion.span
                  key="status"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`text-[10px] font-medium ${isOnline ? 'text-green-500' : 'text-gray-500'}`}
                >
                  {isOnline ? 'Online now' : 'Offline'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Options Dropdown */}
        <div className="relative" ref={menuRef}>
          <motion.button 
            aria-label="More options" 
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
            whileHover={{ scale: 1.08 }} 
            whileTap={{ scale: 0.92 }} 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`btn-icon h-10 w-10 ${isMenuOpen ? 'bg-white/5' : ''}`}
          >
            <MoreVertical className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </motion.button>
          
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute top-full right-0 mt-2 w-48 py-2 bg-[#0f0f12] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
              >
                 <button 
                    onClick={() => {
                      setIsReportModalOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 focus:outline-none"
                  >
                   <Flag className="w-4 h-4" />
                   REPORT USER
                 </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full px-4 pb-4 space-y-4">
        {/* Loading skeleton while messages are being fetched */}
        {isLoadingMessages && messages.length === 0 && (
          <div className="space-y-4 pt-4">
            {[1, 2, 3, 4].map((i) => {
              const isMine = i % 2 === 0;
              return (
                <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="rounded-2xl overflow-hidden relative"
                    style={{
                      width: `${40 + ((i * 13) % 40)}%`,
                      height: '52px',
                      background: isMine
                        ? 'rgba(37, 99, 235, 0.08)'
                        : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isMine ? 'rgba(37, 99, 235, 0.12)' : 'rgba(255, 255, 255, 0.04)'}`,
                    }}
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
                        animation: `shimmer 1.8s ease-in-out infinite`,
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="min-h-4 md:min-h-6" />

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUserId;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] group relative px-4 py-3 text-[14px] leading-relaxed shadow-sm transition-all duration-200 ${
                    isMine
                      ? 'bg-blue-600/15 text-blue-50 border border-blue-500/20 rounded-2xl rounded-tr-sm'
                      : 'bg-[#151518] text-gray-200 border border-white/5 rounded-2xl rounded-tl-sm'
                  }`}
                >
                  {msg.content && (
                    <p style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                      {parseMessageContent(msg.content)}
                    </p>
                  )}
                  {msg.fileUrl && (
                    <div className="mt-2 rounded-xl overflow-hidden border border-white/5 bg-black/20">
                      <img
                        src={msg.fileUrl}
                        alt="Attachment"
                        className="max-h-60 w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                      />
                    </div>
                  )}
                  <span
                    className={`block text-[10px] mt-1.5 font-medium tracking-tight ${
                      isMine ? 'text-blue-200/40 text-right' : 'text-gray-500'
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
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* ── File preview bar ── */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="shrink-0 px-4 mb-2"
          >
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{
                background: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.15)',
              }}
            >
              <div className="h-10 w-10 rounded-xl bg-blue-600/20 flex items-center justify-center shrink-0">
                <Paperclip className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-blue-200 truncate">
                  {selectedFile.name}
                </p>
                <p className="text-[10px] text-blue-400/60 font-medium">
                  {(selectedFile.size / 1024).toFixed(0)} KB • Ready to send
                </p>
              </div>
              <button
                onClick={clearFile}
                className="h-8 w-8 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors"
                aria-label="Remove file"
              >
                <X className="h-4 w-4 text-blue-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Message input bar ── */}
      <div className="shrink-0 px-4 pb-6 md:pb-5 pt-1 relative">
        {/* Emoji Picker Floating Panel */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              ref={emojiPickerRef}
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.9 }}
              className="absolute bottom-full right-4 mb-4 z-50 shadow-3xl"
            >
              <EmojiPicker
                onEmojiClick={handleEmojiSelect}
                width={320}
                height={400}
                skinTonesDisabled
                searchPlaceHolder="Search emoji..."
                previewConfig={{ showPreview: false }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="flex items-center gap-2 rounded-2xl px-2 py-2"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
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
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
            aria-label="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </motion.button>

          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-[15px] text-white placeholder:text-gray-600 py-2.5 px-1 focus:outline-none"
            style={{ maxHeight: '120px' }}
          />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
              showEmojiPicker ? 'text-blue-500 bg-blue-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
            aria-label="Emoji picker"
          >
            <Smile className="h-5 w-5" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={!input.trim()}
            className="h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30 shadow-lg"
            style={{
              background: input.trim()
                ? '#2563eb'
                : 'rgba(255, 255, 255, 0.04)',
              boxShadow: input.trim() ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
            }}
          >
            <Send className="h-5 w-5 text-white" />
          </motion.button>
        </div>
      </div>

      <style jsx>{`
        .glass-header {
           background: rgba(10, 10, 12, 0.85);
           backdrop-filter: blur(20px);
           border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .typing-dots span {
          width: 3.5px;
          height: 3.5px;
        }
      `}</style>
    </div>
  );
}

