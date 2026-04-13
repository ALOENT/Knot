'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Users, AlertTriangle, Search, Ban, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AdminUser {
  id: string;
  username: string;
  email?: string;
  profilePic?: string | null;
  isOnline: boolean;
  role?: string;
}

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'reports'>('overview');

  // Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      closeButtonRef.current?.focus();
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Fetch stats on mount
  useEffect(() => {
    if (!isOpen) return;
    
    // Single fetch for total count using the revamped endpoint
    api.get('/users?limit=1')
      .then((res) => {
        setTotalUsers(res.data.pagination?.total ?? res.data.users?.length ?? 0);
      })
      .catch(() => setTotalUsers(null));
  }, [isOpen]);

  const searchAbortController = useRef<AbortController | null>(null);

  // Reset search state when query is cleared
  useEffect(() => {
    if (!searchQuery.trim()) {
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Search users
  const handleSearch = async () => {
    const queryToSearch = searchQuery.trim();
    if (!queryToSearch) return;

    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }
    const abortController = new AbortController();
    searchAbortController.current = abortController;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await api.get(`/users/search?query=${encodeURIComponent(queryToSearch)}`, {
        signal: abortController.signal
      });
      setSearchResults(res.data.users || []);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        // Ignored cancellation
        return;
      }
      setSearchResults([]);
    } finally {
      if (!abortController.signal.aborted) {
        setIsSearching(false);
      }
    }
  };

  const sectionButtons = [
    { id: 'overview' as const, label: 'Overview', icon: Shield },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'reports' as const, label: 'Reports', icon: AlertTriangle },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100"
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-panel-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-lg max-h-[80vh] z-101 overflow-hidden rounded-2xl border border-white/10 flex flex-col"
            style={{
              background: 'linear-gradient(145deg, rgba(20,20,25,0.97) 0%, rgba(10,10,15,0.97) 100%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.08)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-indigo-400" />
                </div>
                <h2 id="admin-panel-title" className="text-base font-semibold text-white">Admin Control Panel</h2>
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                aria-label="Close admin panel"
                className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Section Tabs */}
            <div className="flex gap-1 px-6 py-3 border-b border-white/4 shrink-0">
              {sectionButtons.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeSection === sec.id
                      ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/3 border border-transparent'
                  }`}
                >
                  <sec.icon className="w-3.5 h-3.5" />
                  {sec.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {activeSection === 'overview' && (
                <div className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Total Users</p>
                      <p className="text-2xl font-bold text-white">{totalUsers ?? '—'}</p>
                    </div>
                    <div
                      className="rounded-xl p-4"
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Active Reports</p>
                      <p className="text-2xl font-bold text-white">0</p>
                    </div>
                  </div>
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: 'rgba(99, 102, 241, 0.04)',
                      border: '1px solid rgba(99, 102, 241, 0.1)',
                    }}
                  >
                    <p className="text-xs text-indigo-300 font-medium mb-1">System Status</p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" style={{ boxShadow: '0 0 8px rgba(34, 197, 94, 0.5)' }} />
                      <span className="text-sm text-gray-300">All systems operational</span>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'users' && (
                <div className="space-y-4">
                  {/* User Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#444] pointer-events-none z-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search users by name or email..."
                      className="chat-input text-xs"
                      style={{ paddingLeft: '40px' }}
                    />
                  </div>

                  {isSearching && (
                    <div className="flex justify-center py-6">
                      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                  )}

                  {!isSearching && searchResults.length > 0 && (
                    <div className="space-y-1">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-white/2 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="h-8 w-8 rounded-full flex items-center justify-center"
                              style={{
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                              }}
                            >
                              {user.profilePic ? (
                                <img src={user.profilePic} alt={user.username} className="h-full w-full rounded-full object-cover" />
                              ) : (
                                <span className="text-xs font-medium text-[#888]">
                                  {user.username.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{user.username}</p>
                              {user.email && <p className="text-[10px] text-gray-500">{user.email}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${user.isOnline ? 'bg-green-500' : 'bg-gray-600'}`} />
                            <span className="text-[10px] text-gray-500">{user.isOnline ? 'Online' : 'Offline'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isSearching && searchResults.length === 0 && hasSearched && searchQuery && (
                    <p className="text-center text-sm text-gray-500 py-6">No users found</p>
                  )}

                  {!searchQuery && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Users className="w-8 h-8 text-gray-600 mb-2" />
                      <p className="text-sm text-gray-500">Search for users to manage</p>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'reports' && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <CheckCircle className="w-6 h-6 text-green-500/60" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-300 mb-1">No Active Reports</h3>
                  <p className="text-xs text-gray-500">All clear — no reported messages to review.</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
