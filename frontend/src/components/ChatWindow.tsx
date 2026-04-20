'use client';

import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Smile, MoreVertical, ArrowLeft, X, BadgeCheck, Flag, Check, CheckCheck, Trash2, Reply, Download, FileText } from 'lucide-react';
import { useSocket } from '@/providers/SocketProvider';
import { useChat } from '@/providers/ChatProvider';
import { api } from '@/lib/api';
import type { ChatUser } from '@/components/ChatList';
import UserProfilePanel from '@/components/UserProfilePanel';
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
  fileName?: string | null;
  attachmentBytes?: number | null;
  attachmentPages?: number | null;
  senderId: string;
  receiverId: string;
  timestamp: string;
  status?: 'SENT' | 'DELIVERED' | 'READ';
  isDeleted?: boolean;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content?: string | null;
    senderId: string;
    sender?: { username: string; displayName?: string | null };
  } | null;
  sender?: {
    id: string;
    username: string;
    displayName?: string | null;
    profilePic?: string | null;
    isVerified?: boolean;
  };
}

interface ChatWindowProps {
  onBack?: () => void;
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

/** Helper to check if a URL points to an image based on extension */
function isImageFile(url: string | null | undefined): boolean {
  if (!url) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  return imageExtensions.some(ext => url.toLowerCase().includes(ext));
}

/**
 * NEXT_PUBLIC_API_URL is sometimes set without `/api` (e.g. http://localhost:5000).
 * Upload and attachment downloads must hit the `/api/...` routes.
 */
function knotApiRoot(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').trim().replace(/\/+$/, '');
  return /\/api$/i.test(raw) ? raw : `${raw}/api`;
}

const API_BASE = knotApiRoot();

/**
 * Simple file action handler: triggers a new tab/download via anchor tag injection.
 * This approach does not require popup permissions and works reliably across browsers.
 */
const handleFileAction = (fileUrl: string | null | undefined, fileName?: string | null) => {
  if (!fileUrl) return;
  
  const link = document.createElement('a');
  link.href = fileUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  // Use download attribute if a filename is provided (best-effort)
  if (fileName) {
    link.download = fileName;
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function formatBytesLabel(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const rounded = i === 0 ? String(Math.round(v)) : v < 10 ? v.toFixed(1) : String(Math.round(v));
  return `${rounded} ${units[i]}`;
}

/** PDF: "N pages · size"; other attachments: size only when known. */
function formatAttachmentMetaLine(
  bytes: number | null | undefined,
  pages: number | null | undefined,
  fileUrl: string,
  displayName: string,
): string {
  const lower = `${displayName} ${fileUrl}`.toLowerCase();
  const isPdf = lower.includes('.pdf');
  const size = formatBytesLabel(bytes);
  if (isPdf && pages != null && pages > 0) {
    const p = `${pages} page${pages === 1 ? '' : 's'}`;
    return size ? `${p} · ${size}` : p;
  }
  return size;
}

function receiverMayDownloadAttachment(
  msg: Pick<Message, 'id' | 'senderId'>,
  currentUserId: string | undefined,
): boolean {
  if (!currentUserId) return false;
  if (msg.senderId === currentUserId) return false;
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(`knot_attachment_dl_${currentUserId}_${msg.id}`) !== '1';
  } catch {
    return true;
  }
}

function markReceiverSavedAttachment(currentUserId: string, messageId: string): void {
  try {
    localStorage.setItem(`knot_attachment_dl_${currentUserId}_${messageId}`, '1');
  } catch {
    /* ignore */
  }
}

function deriveAttachmentDisplayName(fileUrl: string, fileName?: string | null): string {
  if (fileName?.trim()) return fileName.trim();
  try {
    const seg = new URL(fileUrl).pathname.split('/').filter(Boolean).pop() || 'File';
    return seg.replace(/^\d+_/, '') || 'File';
  } catch {
    return 'File';
  }
}

/** PDFs (and other docs) may still use an `/image/upload/` path on Cloudinary — never treat those as photos. */
function isChatDocumentAttachment(url: string): boolean {
  const u = url.toLowerCase();
  const path = u.split('?')[0];
  if (path.endsWith('.pdf')) return true;
  if (['/raw/upload/', '/video/upload/', '/auto/upload/'].some((s) => u.includes(s))) return true;
  return ['.doc', '.docx', '.txt', '.zip', '.ppt', '.pptx', '.xls', '.xlsx'].some((ext) =>
    path.endsWith(ext),
  );
}

/** True only for real image deliveries (inline preview uses public Cloudinary URL). */
function isChatImageAttachment(url: string | null | undefined): boolean {
  if (!url) return false;
  if (isChatDocumentAttachment(url)) return false;
  if (url.includes('/image/upload/')) return true;
  return isImageFile(url);
}

/** WhatsApp-style first page of a PDF (Cloudinary transformation). Falls back via onError in UI. */
function cloudinaryPdfCoverThumbnailUrl(fileUrl: string): string | null {
  if (!fileUrl.toLowerCase().includes('res.cloudinary.com')) return null;
  if (!isChatDocumentAttachment(fileUrl) || !fileUrl.toLowerCase().includes('.pdf')) return null;
  const lower = fileUrl.toLowerCase();
  if (lower.includes('/raw/upload/')) {
    return fileUrl.replace(/\/raw\/upload\//i, '/image/upload/pg_1,w_400,h_520,c_fill,q_best,f_jpg/');
  }
  if (lower.includes('/image/upload/')) {
    return fileUrl.replace(/\/image\/upload\//i, '/image/upload/pg_1,w_400,h_520,c_fill,q_best,f_jpg/');
  }
  return null;
}



/**
 * WhatsApp-style chat date pill label, relative to `now` (pass real "current" time at render).
 * - Same calendar day as now → "Today"
 * - Previous calendar day → "Yesterday"
 * - 2–7 calendar days ago → weekday ("Monday", …)
 * - Older (or future skew) → "15 Jan 2025"
 */
function formatDateSeparator(isoTimestamp: string, now: Date): string {
  const msg = new Date(isoTimestamp);
  if (Number.isNaN(msg.getTime())) return '';

  // Use UTC normalization for DST-safe day counting.
  // This treats each calendar day as exactly 86.4M ms, ignoring local DST shifts.
  const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const utcMsg = Date.UTC(msg.getFullYear(), msg.getMonth(), msg.getDate());
  
  const diffDays = Math.round((utcNow - utcMsg) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays >= 2 && diffDays <= 7) {
    return msg.toLocaleDateString(undefined, { weekday: 'long' });
  }
  return msg.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* ════════════════════════════════════════════
   Component
   ════════════════════════════════════════════ */

export default function ChatWindow({
  onBack,
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

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // New states
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  /** Advances at local midnight so date separators recompute (Today/Yesterday/weekday). */
  const [nowAnchor, setNowAnchor] = useState(() => new Date());
  /** Fixed-position portal so menu is not clipped by scroll parents and closes reliably. */
  const [attachmentMenu, setAttachmentMenu] = useState<{
    top: number;
    left: number;
    showPortalSave: boolean;
    downloadTarget: Pick<Message, 'id' | 'fileUrl'> & { fileName?: string | null };
  } | null>(null);
  const [pdfThumbFailedIds, setPdfThumbFailedIds] = useState<Record<string, boolean>>({});
  /** Bumps after marking localStorage so receiver download UI hides without reload. */
  const [, setDlBump] = useState(0);

  const { 
    activeChat: activeUser, 
    messages, 
    currentUser, 
    sendMessage: onSendMessage, 
    deleteMessage: onDeleteMessage, 
    isLoadingMessages,
    privacyModeEnabled,
    isBlocked,
    isBlockedByMe: checkIsBlockedByMe
  } = useChat();
  
  const currentUserId = currentUser?.id;
  const partnerBlocked = activeUser ? isBlocked(activeUser.id) : false;
  const isOnline = (activeUser && !privacyModeEnabled && !partnerBlocked) ? (onlineUsers.get(activeUser.id) ?? false) : false;
  const isTyping = (activeUser && !partnerBlocked) ? (typingUsers.get(activeUser.id) ?? false) : false;

  // Handle report submission

  const handleBlockUser = async () => {
    if (!activeUser) return;
    setIsBlockedByMe(true);
    setIsMenuOpen(false);
    try {
      await api.post(`/users/block/${activeUser.id}`);
    } catch {
      setIsBlockedByMe(false);
      alert("Failed to block user");
    }
  };

  const handleUnblockUser = async () => {
    if (!activeUser) return;
    setIsBlockedByMe(false);
    try {
      await api.delete(`/users/block/${activeUser.id}`);
    } catch {
      setIsBlockedByMe(true);
      alert("Failed to unblock user");
    }
  };

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

  // Handle Escape to close menus / lightbox
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setShowEmojiPicker(false);
        setAttachmentMenu(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Re-render after local midnight so date labels stay aligned with the real calendar
  useEffect(() => {
    const tick = new Date();
    const nextMidnight = new Date(tick.getFullYear(), tick.getMonth(), tick.getDate() + 1);
    const ms = Math.max(1000, nextMidnight.getTime() - tick.getTime());
    const id = window.setTimeout(() => setNowAnchor(new Date()), ms);
    return () => window.clearTimeout(id);
  }, [nowAnchor]);

  // Initialize isBlockedByMe from context/server state
  useEffect(() => {
    if (activeUser) {
      setIsBlockedByMe(checkIsBlockedByMe(activeUser.id));
    }
  }, [activeUser, checkIsBlockedByMe]);

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

  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !selectedFile) || !activeUser || isUploading || isBlockedByMe) return;

    const attachedOriginalName = selectedFile?.name;
    let fileUrl: string | undefined = undefined;
    let uploadedFileName: string | undefined = undefined;
    let uploadedBytes: number | undefined = undefined;
    let uploadedPages: number | undefined = undefined;

    if (selectedFile) {
      setIsUploading(true);
      setUploadProgress(0);
      
      try {
        const uploaded = await new Promise<{
          fileUrl: string;
          fileName?: string;
          attachmentBytes?: number;
          attachmentPages?: number;
        }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;
          
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setUploadProgress(percent);
            }
          });
          
          xhr.addEventListener('load', () => {
            xhrRef.current = null;
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                if (response.success) {
                  resolve({
                    fileUrl: response.fileUrl,
                    fileName: response.fileName || attachedOriginalName,
                    attachmentBytes:
                      typeof response.attachmentBytes === 'number' ? response.attachmentBytes : undefined,
                    attachmentPages:
                      typeof response.attachmentPages === 'number' ? response.attachmentPages : undefined,
                  });
                } else {
                  reject(new Error(response.message || 'Upload failed'));
                }
              } catch (e) {
                reject(new Error('Invalid response from server'));
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });
          
          xhr.addEventListener('error', () => {
            xhrRef.current = null;
            reject(new Error('Network error during upload'));
          });
          
          xhr.addEventListener('abort', () => {
            xhrRef.current = null;
            reject(new Error('Upload cancelled'));
          });
          
          const formData = new FormData();
          formData.append('file', selectedFile);

          const uploadUrl = `${API_BASE}/upload`;
          xhr.open('POST', uploadUrl);
          // Match axios `api` client: session is the httpOnly `jwt` cookie, not localStorage.
          xhr.withCredentials = true;

          xhr.send(formData);
        });
        
        fileUrl = uploaded.fileUrl;
        uploadedFileName = uploaded.fileName;
        uploadedBytes = uploaded.attachmentBytes;
        uploadedPages = uploaded.attachmentPages;
      } catch (error: any) {
        if (error.message !== 'Upload cancelled') {
          console.error("Failed to upload file", error);
          alert(error.message || "Failed to upload file. Please try again.");
        }
        setIsUploading(false);
        xhrRef.current = null;
        return;
      }
      setIsUploading(false);
      setUploadProgress(0);
    }

    onSendMessage(trimmed, fileUrl, replyingTo?.id, uploadedFileName, uploadedBytes, uploadedPages);
    setInput('');
    setSelectedFile(null);
    setShowEmojiPicker(false);
    setReplyingTo(null);

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

  const cancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
      setIsUploading(false);
      setUploadProgress(0);
    }
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
          <button onClick={() => setIsProfilePanelOpen(true)} className="flex items-center gap-3 min-w-0 text-left cursor-pointer hover:opacity-80 transition-opacity">
            <div className="relative shrink-0">
              <div
                className="h-10 w-10 rounded-2xl flex items-center justify-center overflow-hidden"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {activeUser.profilePic && !partnerBlocked ? (
                  <img
                    src={activeUser.profilePic}
                    alt={activeUser.displayName || activeUser.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className={`text-sm font-bold ${partnerBlocked ? 'text-gray-700' : 'text-gray-500'}`}>
                    {(activeUser.displayName || activeUser.username).charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              {!partnerBlocked && (
                <div
                  className={`absolute -bottom-0.5 -right-0.5 status-dot ${
                    isOnline ? 'online' : 'offline'
                  }`}
                  style={{ width: 10, height: 10, border: '2px solid #0a0a0c' }}
                />
              )}
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
          </button>
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
                      if (isBlockedByMe) {
                        handleUnblockUser();
                      } else {
                        handleBlockUser();
                      }
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2 focus:outline-none"
                  >
                   <span className="w-4 h-4 flex items-center justify-center text-red-500">⚠</span>
                   {isBlockedByMe ? 'UNBLOCK USER' : 'BLOCK USER'}
                 </button>
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
          {messages.map((msg, index) => {
            const isMine = msg.senderId === currentUserId;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const msgDate = new Date(msg.timestamp).toDateString();
            const prevMsgDate = prevMsg ? new Date(prevMsg.timestamp).toDateString() : null;
            const showDateSeparator = msgDate !== prevMsgDate;

            return (
              <Fragment key={msg.id}>
                {showDateSeparator && (
                  <div className="flex justify-center my-5 md:my-6 relative">
                    <div className="absolute inset-0 flex items-center px-6 md:px-10">
                      <div className="w-full border-t border-white/4" />
                    </div>
                    <span className="relative z-10 px-3 py-1 rounded-full bg-white/3 border border-white/6 text-[11px] font-medium text-zinc-500 tabular-nums shadow-sm">
                      {formatDateSeparator(msg.timestamp, nowAnchor)}
                    </span>
                  </div>
                )}
                <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] group relative px-4 py-3 text-[14px] leading-relaxed shadow-sm transition-all duration-200 overflow-visible ${
                    isMine
                      ? 'bg-blue-600/15 text-blue-50 border border-blue-500/20 rounded-2xl rounded-tr-sm'
                      : 'bg-[#151518] text-gray-200 border border-white/5 rounded-2xl rounded-tl-sm'
                  } ${msg.isDeleted ? 'opacity-60 italic' : ''}`}
                >
                  {/* Message Menu */}
                  {!msg.isDeleted && (
                    <div className={`absolute top-2 ${isMine ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1`}>
                      <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Reply">
                         <Reply className="w-3.5 h-3.5" />
                      </button>
                      {isMine && onDeleteMessage && (
                        <button onClick={() => { if (window.confirm("Delete message?")) onDeleteMessage(msg.id); }} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors" title="Delete">
                           <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reply Block */}
                  {msg.replyTo && (
                    <div className="mb-2 pl-3 py-1.5 border-l-2 border-white/20 bg-black/10 rounded-r-lg text-xs">
                      <p className="font-bold text-white/70 mb-0.5">{msg.replyTo.sender?.displayName || msg.replyTo.sender?.username}</p>
                      <p className="text-white/50 truncate pr-2">{msg.replyTo.content || 'Attachment'}</p>
                    </div>
                  )}

                  {msg.isDeleted ? (
                    <div className="flex items-center gap-2 text-gray-500 text-xs">
                      <Trash2 className="w-3 h-3" />
                      <span>This message was deleted</span>
                    </div>
                  ) : msg.content && (
                    <p style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
                      {parseMessageContent(msg.content)}
                    </p>
                  )}
                  {!msg.isDeleted && msg.fileUrl && (() => {
                    const fileUrl = msg.fileUrl!;
                    const displayName = deriveAttachmentDisplayName(fileUrl, msg.fileName || null);
                    const previewUrl = fileUrl;
                    const downloadTarget = {
                      id: msg.id,
                      fileUrl,
                      fileName: msg.fileName || null,
                    };
                    const showDl = receiverMayDownloadAttachment(msg, currentUserId);
                    const metaLine = formatAttachmentMetaLine(
                      msg.attachmentBytes,
                      msg.attachmentPages,
                      fileUrl,
                      displayName,
                    );

                    const openFile = () => {
                      setAttachmentMenu(null);
                      handleFileAction(fileUrl, msg.fileName);
                    };

                    const runDownload = () => {
                      setAttachmentMenu(null);
                      handleFileAction(fileUrl, msg.fileName);
                      if (currentUserId) {
                        markReceiverSavedAttachment(currentUserId, msg.id);
                        setDlBump((n) => n + 1);
                      }
                    };

                    const openDotsMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      const menuWidth = 176;
                      const left = Math.max(
                        10,
                        Math.min(r.right - menuWidth, window.innerWidth - menuWidth - 10),
                      );
                      setAttachmentMenu((cur) =>
                        cur?.downloadTarget.id === msg.id
                          ? null
                          : { top: r.bottom + 6, left, downloadTarget, showPortalSave: true },
                      );
                    };

                    if (isChatImageAttachment(fileUrl)) {
                      return (
                        <div className="mt-2 rounded-xl border border-white/5 bg-black/20 relative z-0 overflow-visible">
                          <div className="rounded-xl overflow-hidden">
                            <button
                              type="button"
                              onClick={openFile}
                              className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                            >
                              <img
                                src={previewUrl}
                                alt={displayName}
                                loading="lazy"
                                className="max-h-60 w-full object-cover cursor-zoom-in bg-black/30"
                              />
                            </button>
                          </div>
                          {metaLine ? (
                            <p className="text-[10px] text-zinc-500 px-1 pt-1.5">{metaLine}</p>
                          ) : null}
                          {showDl ? (
                            <div className="absolute top-2 right-2 z-20">
                              <button
                                type="button"
                                aria-label="Attachment options"
                                onClick={openDotsMenu}
                                className="h-8 w-8 rounded-full bg-black/65 border border-white/12 flex items-center justify-center text-gray-100 hover:bg-black/80 shadow-md backdrop-blur-sm"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    }

                    const pdfThumb = cloudinaryPdfCoverThumbnailUrl(fileUrl);
                    const thumbFailed = !!pdfThumbFailedIds[msg.id];
                    const showPdfThumb = !!pdfThumb && !thumbFailed;

                    const openPdfInline = () => {
                      handleFileAction(fileUrl, msg.fileName);
                    };

                    return (
                      <div className="mt-2.5 rounded-2xl border border-white/10 bg-black/30 relative overflow-hidden min-w-[280px] max-w-full shadow-lg">
                        {showPdfThumb ? (
                          <button
                            type="button"
                            onClick={openPdfInline}
                            className="h-24 w-full overflow-hidden bg-zinc-950 border-b border-white/5 relative block"
                          >
                            <img
                              src={pdfThumb!}
                              alt=""
                              loading="lazy"
                              className="w-full h-full object-cover object-top opacity-80"
                              onError={() =>
                                setPdfThumbFailedIds((prev) => ({ ...prev, [msg.id]: true }))
                              }
                            />
                            <div className="absolute top-2 left-2 bg-red-600/90 text-[9px] font-bold text-white px-1.5 py-0.5 rounded shadow-sm">
                              PDF
                            </div>
                          </button>
                        ) : null}
                        
                        <div className="p-2.5 px-3 flex items-center gap-3">
                          <div className="h-9 w-9 shrink-0 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-red-500" strokeWidth={2} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-bold text-white truncate pr-2">
                              {displayName}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">
                              {metaLine || 'Document'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isMine ? (
                              <button
                                type="button"
                                onClick={openFile}
                                className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] font-bold text-blue-400 hover:bg-blue-500/20 transition-colors"
                              >
                                OPEN
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={runDownload}
                                className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-[11px] font-bold text-green-400 hover:bg-green-500/20 transition-colors flex items-center gap-1.5"
                              >
                                <Download className="h-3 w-3" />
                                {showDl ? 'DOWNLOAD' : 'OPEN'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={openDotsMenu}
                              className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <span
                    className={`flex items-center gap-1 text-[10px] mt-1.5 font-medium tracking-tight ${
                      isMine ? 'justify-end text-blue-200/40' : 'justify-start text-gray-500'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {isMine && !msg.isDeleted && (
                       <span className="ml-0.5 inline-flex items-center" title={msg.status}>
                         {msg.status === 'SENT' && <Check className="w-3 h-3 opacity-60" />}
                         {msg.status === 'DELIVERED' && <CheckCheck className="w-3 h-3 opacity-60" />}
                         {msg.status === 'READ' && <CheckCheck className="w-3 h-3 text-blue-400" />}
                       </span>
                    )}
                  </span>
                </div>
              </motion.div>
            </Fragment>
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
                {isUploading ? (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex justify-between items-center text-[9px] font-bold text-blue-400/80 uppercase tracking-tighter">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-blue-500/10 rounded-full overflow-hidden border border-white/5">
                      <motion.div 
                        className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-blue-400/60 font-medium">
                    {(selectedFile.size / 1024).toFixed(0)} KB • Ready to send
                  </p>
                )}
              </div>
              <button
                onClick={isUploading ? cancelUpload : clearFile}
                className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${
                  isUploading 
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' 
                    : 'hover:bg-white/5 text-blue-400'
                }`}
                aria-label={isUploading ? "Cancel upload" : "Remove file"}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Message input bar ── */}
      <div className="shrink-0 px-4 pb-6 md:pb-5 pt-1 relative">
        {isBlockedByMe ? (
           <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-white/10 text-center gap-3">
             <p className="text-sm font-medium text-gray-400">You have blocked this user.</p>
             <button onClick={handleUnblockUser} className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors">
               UNBLOCK
             </button>
           </div>
        ) : (
          <>
            {/* Reply bar */}
            <AnimatePresence>
              {replyingTo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="px-4 py-2 mb-2 bg-white/5 rounded-t-2xl border-l-[3px] border-blue-500 relative"
                >
                  <p className="text-xs font-bold text-blue-400">{replyingTo.senderId === currentUserId ? 'You' : (replyingTo.sender?.displayName || replyingTo.sender?.username)}</p>
                  <p className="text-xs text-gray-300 truncate pr-8">{replyingTo.content || 'Attachment'}</p>
                  <button onClick={() => setReplyingTo(null)} className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
            disabled={(!input.trim() && !selectedFile) || isUploading}
            className="h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-30 shadow-lg"
            style={{
              background: input.trim() || selectedFile
                ? '#2563eb'
                : 'rgba(255, 255, 255, 0.04)',
              boxShadow: input.trim() || selectedFile ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
            }}
          >
            <Send className="h-5 w-5 text-white" />
          </motion.button>
        </div>
      </>
        )}
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


      {/* Report User Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[#0f0f12] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-white">Report User</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Help us keep Knot safe by reporting violations.
                  </p>
                </div>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="btn-icon h-9 w-9"
                  disabled={isSubmittingReport}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Reason for reporting
                  </label>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Describe the issue (harassment, spam, etc.)..."
                    rows={4}
                    className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-sm text-gray-200 placeholder:text-gray-700 focus:outline-none focus:border-red-500/50 transition-colors resize-none"
                    disabled={isSubmittingReport}
                  />
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
                  <Flag className="h-4 w-4 text-yellow-500/60 shrink-0" />
                  <p className="text-[10px] text-yellow-500/60 leading-tight">
                    Reports are reviewed by admins. False reporting may lead to account suspension.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-white/1 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-white transition-colors"
                  disabled={isSubmittingReport}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSendReport}
                  disabled={!reportReason.trim() || isSubmittingReport}
                  className="px-6 py-2 bg-red-600 rounded-xl font-bold text-xs text-white tracking-wide shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmittingReport ? (
                    'SUBMITTING...'
                  ) : (
                    <>
                      <Flag className="w-3 h-3" />
                      SUBMIT REPORT
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <UserProfilePanel
        userId={activeUser.id}
        isOpen={isProfilePanelOpen}
        onClose={() => setIsProfilePanelOpen(false)}
      />

      {attachmentMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[85]"
              aria-hidden
              onMouseDown={() => setAttachmentMenu(null)}
            />
            <div
              role="menu"
              className="fixed z-[90] min-w-[176px] rounded-xl bg-[#16161a] border border-white/10 shadow-2xl py-1"
              style={{ top: attachmentMenu.top, left: attachmentMenu.left }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {attachmentMenu.showPortalSave ? (
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-left text-xs font-medium text-gray-100 hover:bg-white/[0.07] flex items-center gap-2"
                   onClick={() => {
                     const t = attachmentMenu.downloadTarget;
                     setAttachmentMenu(null);
                     handleFileAction(t.fileUrl, t.fileName);
                     if (currentUserId) {
                       markReceiverSavedAttachment(currentUserId, t.id);
                       setDlBump((n) => n + 1);
                     }
                   }}
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  Save to device
                </button>
              ) : null}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
