'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Activity, Flag, AlertTriangle } from 'lucide-react';
import ChatList from '@/components/ChatList';
import ChatWindow from '@/components/ChatWindow';
import Sidebar, { TabType } from '@/components/Sidebar';
import SearchPanel, { SearchResult } from '@/components/SearchPanel';
import SettingsSection from '@/components/SettingsSection';
import AdminPanel from '@/components/AdminPanel';
import { useChat } from '@/providers/ChatProvider';
import { useSocket } from '@/providers/SocketProvider';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import type { ChatUser } from '@/components/ChatList';

export default function DashboardPage() {
  const router = useRouter();
  const { currentUser, activeChat, messages, setActiveChat, sendMessage, isLoadingMessages, deleteMessage } = useChat();
  const { lastReceivedMessage } = useSocket();
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  
  // SPA State
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  
  // Responsive view state
  const [showRightPanel, setShowRightPanel] = useState(false); // For mobile
  const [isMobile, setIsMobile] = useState(false);

  // Warnings State
  const [warnings, setWarnings] = useState<{id: string, message: string}[]>([]);
  const [currentWarning, setCurrentWarning] = useState<{id: string, message: string} | null>(null);

  // Handle mobile detection to avoid hydration mismatch
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // Initial check
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ── Fetch chat users (conversations with last message, or fallback to all users) ──
  useEffect(() => {
    // Try conversations endpoint first, then fall back to users list
    api.get('/messages/conversations')
      .then((res) => {
        const convos = res.data.conversations || [];
        if (convos.length > 0) {
          setChatUsers(convos);
        } else {
          // No conversations yet, fall back to showing all users
          return api.get('/users').then((r) => setChatUsers(r.data.users || []));
        }
      })
      .catch(() => {
        // Fallback: just show all users
        api.get('/users')
          .then((res) => setChatUsers(res.data.users || []))
          .catch((err) => console.error('Failed to load contacts', err));
      });
  }, []);

  // ── Fetch warnings ──
  useEffect(() => {
    if (!currentUser) return;
    api.get('/users/warnings')
      .then((res) => {
        if (res.data.success && res.data.warnings?.length > 0) {
          setWarnings(res.data.warnings);
          setCurrentWarning(res.data.warnings[0]);
        }
      })
      .catch((err) => console.error('Failed to load warnings', err));
  }, [currentUser]);

  // Keep a ref to activeChat to avoid re-triggering socket effect when switching chats
  const activeChatRef = useRef(activeChat?.id);
  useEffect(() => {
    activeChatRef.current = activeChat?.id;
  }, [activeChat?.id]);

  // Keep track of the last processed message to prevent duplicate updates
  const lastMsgIdRef = useRef<string | null>(null);

  // ── Real-time sidebar sync: update chat list on incoming messages ──
  useEffect(() => {
    if (!lastReceivedMessage || !currentUser) return;
    if (lastMsgIdRef.current === lastReceivedMessage.id) return;
    lastMsgIdRef.current = lastReceivedMessage.id;

    const msg = lastReceivedMessage;
    const isFromMe = msg.senderId === currentUser.id;
    const partnerId = isFromMe ? msg.receiverId : msg.senderId;

    setChatUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === partnerId);
      const preview = msg.content?.slice(0, 50) || 'Attachment';
      const time = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      if (idx !== -1) {
        const updated = [...prev];
        const user = { ...updated[idx], lastMessage: preview, lastMessageTime: time };
        // Increment unread only if message is from someone else AND not the active chat
        if (!isFromMe && activeChatRef.current !== partnerId) {
          user.unreadCount = (user.unreadCount || 0) + 1;
        }
        updated.splice(idx, 1);
        return [user, ...updated]; // Move to top
      } else if (msg.sender && !isFromMe) {
        // New conversation from an unknown user
        return [
          {
            id: msg.sender.id,
            username: msg.sender.username,
            profilePic: msg.sender.profilePic,
            lastMessage: preview,
            lastMessageTime: time,
            unreadCount: activeChatRef.current !== partnerId ? 1 : 0,
          },
          ...prev,
        ];
      }
      return prev;
    });
  }, [lastReceivedMessage, currentUser]);

  // ── Handlers ──
  // Handle selective view side-effects when chat is selected
  useEffect(() => {
    if (activeChat) {
      if (isMobile) {
        setShowRightPanel(true);
      }
      
      // Reset unread count for the newly active chat
      setChatUsers((prev) => {
        const hasUnread = prev.find(u => u.id === activeChat.id && (u.unreadCount || 0) > 0);
        if (!hasUnread) return prev; // Avoid unnecessary re-renders if count is already 0
        return prev.map((u) => (u.id === activeChat.id ? { ...u, unreadCount: 0 } : u));
      });
    }
  }, [activeChat, isMobile]);

  const handleBack = useCallback(() => {
    setShowRightPanel(false);
    setActiveChat(null);
  }, [setActiveChat]);

  const handleMessageSearchedUser = (result: SearchResult) => {
    // Check if user is already in chatUsers, if not add them
    const existing = chatUsers.find(u => u.id === result.id);
    const userToSelect = existing || {
      id: result.id,
      username: result.username,
      displayName: result.displayName,
      profilePic: result.profilePic,
      isVerified: result.isVerified
    };
    
    if (!existing) {
      setChatUsers(prev => [userToSelect as ChatUser, ...prev]);
    }
    
    setActiveChat(userToSelect as ChatUser);
    setActiveTab('messages');
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignored
    } finally {
      router.push('/login');
    }
  };

  const handleDismissWarning = async () => {
    if (!currentWarning) return;
    try {
      await api.put(`/users/warnings/${currentWarning.id}/dismiss`);
      const remaining = warnings.filter(w => w.id !== currentWarning.id);
      setWarnings(remaining);
      setCurrentWarning(remaining.length > 0 ? remaining[0] : null);
    } catch (err) {
      console.error('Failed to dismiss warning', err);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'settings') {
      setShowRightPanel(true);
    } else if (showRightPanel && activeChat === null) {
      setShowRightPanel(false);
    }
  };

  // ── Panel Renderers ──
  const renderLeftPanel = () => {
    switch (activeTab) {
      case 'messages':
      case 'contacts': // For now, Contacts just shows ChatList too
      case 'settings': // Maintain left list when entering settings
        return (
          <ChatList
            users={chatUsers}
          />
        );
      case 'search':
        return <SearchPanel onMessageUser={handleMessageSearchedUser} />;
      case 'groups':
        return (
           <div className="flex flex-col items-center justify-center h-full text-center p-8" style={{ background: 'rgba(10, 10, 10, 0.6)' }}>
             <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                <span className="text-2xl">🚧</span>
             </div>
             <h2 className="text-xl font-bold text-gray-200 mb-2">Groups Coming Soon</h2>
             <p className="text-sm text-gray-500">Group chats and channels are currently under development.</p>
           </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 h-dvh w-full overflow-hidden flex flex-col md:flex-row bg-[#0a0a0c]">
      {/* ── Sidebar (Desktop: Left, Mobile: Bottom) ── */}
      <Sidebar 
        activeTab={activeTab} 
        onChangeTab={handleTabChange} 
        onOpenAdmin={() => setIsAdminOpen(true)}
        currentUser={currentUser}
      />

      {/* Admin Control Panel — only renders for admin users */}
      <AdminPanel
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
      />

      {/* ── Main Content Area ── */}
      <main className="flex-1 h-full relative overflow-hidden md:pl-(--sidebar-w) pb-[calc(68px+env(safe-area-inset-bottom))] md:pb-0">
        <div className="flex h-full w-full relative">
          
          {/* ── Left Content Pane (List/Search) ── */}
          <motion.div
            initial={false}
            animate={{ 
              x: (showRightPanel && isMobile) ? '-100%' : 0,
              opacity: (showRightPanel && isMobile) ? 0 : 1
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`absolute inset-0 md:relative md:inset-auto h-full shrink-0 z-10 w-full md:w-(--chat-list-w) ${
              showRightPanel ? (isMobile ? 'pointer-events-none' : 'invisible md:visible') : 'visible'
            }`}
            style={{
              background: '#0a0a0c',
              borderRight: '1px solid rgba(255, 255, 255, 0.04)',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full w-full"
              >
                {renderLeftPanel()}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* ── Right Content Pane (Chat Window / Settings) ── */}
          <motion.div
            initial={false}
            animate={{ 
              x: (!showRightPanel && isMobile) ? '100%' : 0,
              opacity: (!showRightPanel && isMobile) ? 0 : 1
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`absolute inset-0 md:relative md:inset-auto flex-1 h-full z-20 md:z-auto bg-[#0a0a0c] ${
              (!showRightPanel && isMobile) ? 'md:invisible' : 'visible'
            }`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab === 'settings' ? 'settings' : activeChat?.id ?? 'empty'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full w-full"
              >
                {activeTab === 'settings' ? (
                  <SettingsSection onBack={handleBack} />
                ) : activeChat && currentUser ? (
                  <ChatWindow
                    onBack={handleBack}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-4 px-6">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center">
                      <span className="text-3xl">👋</span>
                    </div>
                    <p className="text-lg font-medium text-gray-300">Select a conversation</p>
                    <p className="text-sm">Or use Search to find new people</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

        </div>
      </main>
      {/* ── Admin Warning Modal ── */}
      <AnimatePresence>
        {currentWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-[#0f0f12] border border-red-500/20 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)]"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Official Warning</h2>
                <div className="bg-white/5 border border-white/5 rounded-2xl p-6 mb-8">
                  <p className="text-gray-300 leading-relaxed text-sm italic">
                    "{currentWarning.message}"
                  </p>
                </div>
                <button
                  onClick={handleDismissWarning}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
                >
                  I Understand
                </button>
                <p className="mt-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  Knot Safety Enforcement
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
