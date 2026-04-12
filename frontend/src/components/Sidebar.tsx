'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Users,
  Settings,
  LogOut,
  Search,
  Shield,
} from 'lucide-react';

const navItems = [
  { icon: MessageSquare, href: '/dashboard', label: 'Chats' },
  { icon: Users, href: '/dashboard/contacts', label: 'Contacts' },
  { icon: Search, href: '/dashboard/search', label: 'Search' },
  { icon: Settings, href: '/dashboard/settings', label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignored
    } finally {
      router.push('/login');
    }
  };

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col items-center justify-between h-screen glass-sidebar py-6 fixed left-0 top-0 z-40"
        style={{ width: 'var(--sidebar-w)' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-8">
          <Link href="/dashboard" className="group">
            <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow duration-300">
              <span className="text-white font-bold text-lg">K</span>
              <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </div>
          </Link>

          {/* Nav Icons */}
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname?.startsWith(item.href));

              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    className={`btn-icon relative ${isActive ? 'active' : ''}`}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    title={item.label}
                  >
                    <item.icon className="h-5 w-5" />
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-xl bg-indigo-500/12 border border-indigo-500/20"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom — Logout */}
        <div className="flex flex-col gap-2">
          <button
            className="btn-icon hover:text-red-400"
            title="Sign Out"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel-heavy border-t border-white/6">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href));

            return (
              <Link key={item.href} href={item.href} className="relative">
                <motion.div
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
                    isActive ? 'text-indigo-400' : 'text-gray-500'
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="mobile-tab-active"
                      className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
          
          <button onClick={handleLogout} className="relative flex flex-col items-center gap-1 p-2 rounded-xl transition-colors text-red-500/80 hover:text-red-500">
            <motion.div whileTap={{ scale: 0.9 }} className="flex flex-col items-center gap-1">
              <LogOut className="h-5 w-5" />
              <span className="text-[10px] font-medium">Log out</span>
            </motion.div>
          </button>
        </div>
      </nav>
    </>
  );
}
