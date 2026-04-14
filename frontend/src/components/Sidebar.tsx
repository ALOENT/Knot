'use client';

import { motion } from 'framer-motion';
import {
  MessageSquare,
  Users,
  Search,
  Settings,
  Hash,
  Shield
} from 'lucide-react';
import type { AuthUser } from '@/providers/ChatProvider';

export type TabType = 'messages' | 'groups' | 'contacts' | 'search';

const navItems: { icon: any; id: TabType; label: string }[] = [
  { icon: MessageSquare, id: 'messages', label: 'Chats' },
  { icon: Hash, id: 'groups', label: 'Groups' },
  { icon: Users, id: 'contacts', label: 'Contacts' },
  { icon: Search, id: 'search', label: 'Search' },
];

interface SidebarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  onOpenProfile: () => void;
  onOpenAdmin?: () => void;
  currentUser?: AuthUser | null;
}

export default function Sidebar({ activeTab, onChangeTab, onOpenProfile, onOpenAdmin, currentUser }: SidebarProps) {
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <>
      {/* ── Desktop Sidebar — Slim icon rail ── */}
      <aside
        className="hidden md:flex flex-col items-center justify-between h-screen glass-sidebar py-5 fixed left-0 top-0 z-40"
        style={{ width: 'var(--sidebar-w)' }}
      >
        {/* Nav tabs */}
        <div className="flex flex-col items-center gap-1">
          <nav className="flex flex-col gap-1 w-full px-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChangeTab(item.id)}
                  className={`relative w-full aspect-square flex items-center justify-center rounded-xl transition-colors ${
                    isActive ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
                  }`}
                  title={item.label}
                >
                  <item.icon className="h-5 w-5 relative z-1" />
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 rounded-xl bg-indigo-500/10 border border-indigo-500/20"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom actions: Admin (if admin) + Settings/Profile */}
        <div className="flex flex-col items-center gap-2">
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              className="btn-icon"
              title="Admin Control Panel"
            >
              <Shield className="h-5 w-5 text-indigo-400" />
            </button>
          )}
          <button
            className="btn-icon hover:text-indigo-400!"
            title="Profile & Settings"
            onClick={onOpenProfile}
          >
            <Settings className="h-5 w-5" />
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
                <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'text-indigo-400' : 'text-gray-500'}`}>
                   <item.icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                </div>
                {isActive && (
                  <motion.div
                    layoutId="mobile-active-indicator"
                    className="absolute top-0 w-8 h-[2px] bg-indigo-500 rounded-b-full shadow-[0_2px_8px_rgba(99,102,241,0.5)]"
                  />
                )}
              </button>
            );
          })}
          {/* Settings tab on mobile */}
          <button
            onClick={onOpenProfile}
            className="relative flex-1 flex flex-col items-center justify-center h-full"
          >
            <div className="p-2 rounded-xl transition-all duration-300 text-gray-500">
              <Settings className="h-5 w-5" />
            </div>
          </button>
        </div>
      </nav>
    </>
  );
}
