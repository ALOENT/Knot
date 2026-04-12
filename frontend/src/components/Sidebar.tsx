'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Users,
  Search,
  Settings,
  LogOut,
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
      {/* ── Desktop Sidebar — Slim icon rail ── */}
      <aside
        className="hidden md:flex flex-col items-center justify-between h-screen glass-sidebar py-5 fixed left-0 top-0 z-40"
        style={{ width: 'var(--sidebar-w)' }}
      >
        {/* Logo + Nav */}
        <div className="flex flex-col items-center gap-6">
          <Link href="/dashboard">
            <div className="h-8 w-8 rounded-lg bg-[#6366f1] flex items-center justify-center">
              <span className="text-white font-bold text-sm">K</span>
            </div>
          </Link>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname?.startsWith(item.href));

              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    className={`btn-icon relative ${isActive ? 'active' : ''}`}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    title={item.label}
                  >
                    <item.icon className="h-[18px] w-[18px] relative z-[1]" />
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-lg"
                        style={{
                          background: 'rgba(99, 102, 241, 0.08)',
                          border: '1px solid rgba(99, 102, 241, 0.12)',
                        }}
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout */}
        <button
          className="btn-icon hover:!text-red-400"
          title="Sign Out"
          onClick={handleLogout}
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </aside>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: 'rgba(3, 3, 3, 0.92)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        <div className="flex items-center justify-around h-14 px-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href));

            return (
              <Link key={item.href} href={item.href} className="relative">
                <motion.div
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-lg transition-colors ${
                    isActive ? 'text-[#818cf8]' : 'text-[#555]'
                  }`}
                  whileTap={{ scale: 0.9 }}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 p-2 rounded-lg text-[#555] hover:text-red-400 transition-colors"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span className="text-[10px] font-medium">Log out</span>
          </button>
        </div>
      </nav>
    </>
  );
}
