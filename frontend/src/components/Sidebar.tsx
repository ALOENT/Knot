'use client';

import { motion } from 'framer-motion';
import {
  MessageCircle,
  Hash,
  Users,
  Search,
  Shield,
  UserCircle
} from 'lucide-react';
import type { AuthUser } from '@/providers/ChatProvider';

export type TabType = 'messages' | 'groups' | 'contacts' | 'search' | 'settings';

const navItems: { icon: any; id: TabType; label: string }[] = [
  { icon: MessageCircle, id: 'messages', label: 'Chats' },
  { icon: Hash, id: 'groups', label: 'Groups' },
  { icon: Users, id: 'contacts', label: 'Contacts' },
  { icon: Search, id: 'search', label: 'Search' },
];

interface SidebarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onOpenAdmin?: () => void;
  currentUser?: AuthUser | null;
}

export default function Sidebar({ activeTab, onChangeTab, onOpenAdmin, currentUser }: SidebarProps) {
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <>
      {/* ── Desktop Sidebar — Slim icon rail, w-16 (64px) ── */}
      <aside
        className="hidden md:flex flex-col items-center justify-between h-screen glass-sidebar py-5 fixed left-0 top-0 z-40"
        style={{ width: 'var(--sidebar-w)' }}
      >
        {/* Nav tabs */}
        <div className="flex flex-col items-center gap-1 w-full">
          <nav className="flex flex-col gap-3 w-full px-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeTab(item.id)}
                  className={`relative w-full aspect-square flex items-center justify-center rounded-xl transition-colors ${
                    isActive ? 'text-blue-500' : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title={item.label}
                >
                  <item.icon className="h-5 w-5 relative z-[1]" strokeWidth={1.25} />
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-blue-500/10 border border-blue-500/20"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom actions: Admin (if admin) + Profile avatar */}
        <div className="flex flex-col items-center gap-4 w-full">
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="btn-icon"
              title="Admin Control Panel"
            >
              <Shield className="h-5 w-5 text-blue-500" strokeWidth={1.25} />
            </button>
          )}

          {/* Profile avatar / icon at very bottom */}
          <button
            type="button"
            className="w-9 h-9 p-0 bg-transparent rounded-full flex items-center justify-center overflow-hidden cursor-pointer border border-white/10 hover:border-blue-500/40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title={currentUser?.displayName || currentUser?.username || 'Profile'}
            aria-label={currentUser?.displayName || currentUser?.username || 'Profile'}
            onClick={() => onChangeTab('settings')}
          >
            {currentUser?.profilePic ? (
              <img
                src={currentUser.profilePic}
                alt={currentUser.displayName || currentUser.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <UserCircle className="h-5 w-5 text-gray-500" strokeWidth={1.25} />
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
        style={{
          background: 'rgba(10, 10, 12, 0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div className="flex items-center justify-around h-[68px] px-2 pb-safe">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id)}
                className="relative flex-1 flex flex-col items-center justify-center h-full"
              >
                <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'text-blue-500' : 'text-gray-500'}`}>
                   <item.icon strokeWidth={1.25} className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                </div>
                {isActive && (
                  <motion.div
                    layoutId="mobile-active-indicator"
                    className="absolute top-0 w-8 h-[2px] bg-blue-500 rounded-b-full shadow-[0_2px_8px_rgba(37,99,235,0.5)]"
                  />
                )}
              </button>
            );
          })}
          {/* Profile/Settings tab on mobile */}
          <button
            type="button"
            onClick={() => onChangeTab('settings')}
            className={`relative flex-1 flex flex-col items-center justify-center h-full ${activeTab === 'settings' ? 'text-blue-500' : 'text-gray-500'}`}
            title={currentUser?.displayName || currentUser?.username || 'Profile'}
            aria-label={currentUser?.displayName || currentUser?.username || 'Profile'}
          >
            <div className="p-2 rounded-xl transition-all duration-300">
               {currentUser?.profilePic ? (
                  <div className={`w-6 h-6 rounded-full overflow-hidden border ${activeTab === 'settings' ? 'border-blue-500' : 'border-transparent'} transition-transform duration-300 ${activeTab === 'settings' ? 'scale-110' : ''}`}>
                     <img src={currentUser.profilePic} alt={currentUser.displayName || currentUser.username || 'Profile'} className="w-full h-full object-cover" />
                  </div>
               ) : (
                  <UserCircle strokeWidth={1.25} className={`h-5 w-5 transition-transform duration-300 ${activeTab === 'settings' ? 'scale-110' : ''}`} />
               )}
            </div>
            {activeTab === 'settings' && (
              <motion.div
                layoutId="mobile-active-indicator"
                className="absolute top-0 w-8 h-[2px] bg-blue-500 rounded-b-full shadow-[0_2px_8px_rgba(37,99,235,0.5)]"
              />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
