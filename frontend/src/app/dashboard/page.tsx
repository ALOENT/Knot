'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const { currentUser, activeChat, messages, setActiveChat, sendMessage, isLoadingMessages } = useChat();
  const { lastReceivedMessage } = useSocket();
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  
  // SPA State
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  
  // Responsive view state
  const [showRightPanel, setShowRightPanel] = useState(false); // For mobile

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
  const handleSelectChat = useCallback((user: ChatUser) => {
    setActiveChat(user);
    setShowRightPanel(true);
    // Reset unread count for this chat
    setChatUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, unreadCount: 0 } : u)),
    );
  }, [setActiveChat]);

  const handleMessageSearchedUser = useCallback((user: SearchResult) => {
    // Switch back to messages tab and make them active
    setActiveTab('messages');
    setActiveChat({
      id: user.id,
      username: user.username,
      profilePic: user.profilePic,
      isOnline: user.isOnline,
    });
    setShowRightPanel(true);
  }, [setActiveChat]);

  const handleSendMessage = useCallback(
    (content: string) => {
      sendMessage(content);
      if (activeChat) {
        const preview = content.slice(0, 50);
        const time = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        setChatUsers((prev) => {
          const idx = prev.findIndex((u) => u.id === activeChat.id);
          if (idx === -1) return prev;
          const updated = [...prev];
          const user = {
            ...updated[idx],
            lastMessage: preview,
            lastMessageTime: time,
          };
          updated.splice(idx, 1);
          return [user, ...updated];
        });
      }
    },
    [sendMessage, activeChat],
  );

  const handleBack = useCallback(() => {
    setShowRightPanel(false);
    setActiveChat(null);
  }, [setActiveChat]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignored
    } finally {
      router.push('/login');
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
            activeChatId={activeChat?.id ?? null}
            onSelectChat={handleSelectChat}
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
    <div className="flex h-full w-full">
      {/* ── Sidebar ── */}
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

      {/* ── Main Layout Wrapper ── */}
      <div className="flex flex-1 h-full md:pl-(--sidebar-w)">
        
        {/* ── Left Content Pane (List/Search) ── */}
        <div
          className={`h-full shrink-0 relative z-10 ${showRightPanel ? 'hidden md:block' : 'block w-full md:w-(--chat-list-w)'}`}
          style={{
            background: '#0a0a0c',
            borderRight: '1px solid rgba(255, 255, 255, 0.04)',
          }}
        >
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              {renderLeftPanel()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Right Content Pane (Chat Window) ── */}
        <div
          className={`flex-1 h-full relative min-w-0 ${!showRightPanel ? 'hidden md:block' : 'block w-full'}`}
          style={{ background: '#0a0a0c' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab === 'settings' ? 'settings' : activeChat?.id ?? 'empty'}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              {activeTab === 'settings' ? (
                <SettingsSection />
              ) : activeChat && currentUser ? (
                <ChatWindow
                  activeUser={activeChat}
                  messages={messages}
                  currentUserId={currentUser.id}
                  onSendMessage={handleSendMessage}
                  onBack={handleBack}
                  isLoadingMessages={isLoadingMessages}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center">
                    <span className="text-3xl">👋</span>
                  </div>
                  <p className="text-lg font-medium text-gray-300">Select a conversation</p>
                  <p className="text-sm">Or use Search to find new people</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
