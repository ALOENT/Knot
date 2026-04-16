import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Users, Activity, Ban, CheckCircle, XCircle, BadgeCheck, X } from 'lucide-react';
import { api } from '@/lib/api';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  profilePic: string | null;
  role: string;
  isBanned: boolean;
  isVerified: boolean;
}

interface Stats {
  totalAgents: number;
  activeConversations: number;
  bannedEntities: number;
}

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats>({ totalAgents: 0, activeConversations: 0, bannedEntities: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      fetchAdminData();
    }
  }, [isOpen]);

  const fetchAdminData = async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const res = await api.get('/admin/users');
      if (res.data.success) {
        setUsers(res.data.data.users);
        setStats(res.data.data.stats);
      } else {
        setFetchError('Failed to load admin data');
      }
    } catch (error) {
      console.error('Failed to fetch admin data', error);
      setFetchError('Failed to fetch admin data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (userId: string, updates: { isBanned?: boolean; isVerified?: boolean }) => {
    if (loadingUsers[userId]) return;
    
    try {
      setLoadingUsers(prev => ({ ...prev, [userId]: true }));
      // Optimistic update
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...updates } : u)));
      setFetchError(null);
      
      const res = await api.put('/admin/update-status', { userId, ...updates });
      
      if (!res.data.success) {
        // Revert on failure
        await fetchAdminData();
        setFetchError(res.data.message || 'Failed to update user. Changes reverted.');
      }
    } catch (error) {
      console.error('Failed to update user status', error);
      await fetchAdminData();
      setFetchError('Failed to update user status. Changes reverted.');
    } finally {
      setLoadingUsers(prev => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="fixed inset-0 z-50 flex flex-col bg-(--background) text-white overflow-hidden"
        >
        {/* Header */}
        <div className="flex px-8 py-6 items-center justify-between border-b border-white/5 bg-white/1 shrink-0">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-semibold tracking-tight">Command Center</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <X className="h-6 w-6 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto w-full p-8 max-w-7xl mx-auto space-y-8">
          {/* Top Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 flex items-center gap-4">
               <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                  <ShieldCheck className="h-6 w-6" />
               </div>
               <div>
                  <p className="text-sm text-blue-200/60 font-medium">Total Agents</p>
                  <p className="text-2xl font-bold text-white">{stats.totalAgents}</p>
               </div>
            </div>
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 flex items-center gap-4">
               <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                  <Activity className="h-6 w-6" />
               </div>
               <div>
                  <p className="text-sm text-blue-200/60 font-medium">Active Conversations</p>
                  <p className="text-2xl font-bold text-white">{stats.activeConversations}</p>
               </div>
            </div>
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 flex items-center gap-4">
               <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                  <Ban className="h-6 w-6" />
               </div>
               <div>
                  <p className="text-sm text-blue-200/60 font-medium">Banned Entities</p>
                  <p className="text-2xl font-bold text-white">{stats.bannedEntities}</p>
               </div>
            </div>
          </div>

          {/* User Management Table */}
          <div className="bg-[#0a0a0c] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center">
              <Users className="w-5 h-5 text-gray-400 mr-2" />
              <h3 className="font-medium">User Database</h3>
            </div>
            
            {fetchError && (
              <div className="bg-red-500/10 border-l-4 border-red-500 text-red-300 p-4 m-4 rounded-lg flex justify-between items-center text-sm font-medium">
                {fetchError}
                <button onClick={() => setFetchError(null)} className="text-red-400 hover:text-red-300">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-8 flex justify-center items-center text-gray-500">
                  Loading entities...
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/2">
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">User</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">God-Mode Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.length === 0 && !isLoading && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium">
                          No users found
                        </td>
                      </tr>
                    )}
                    {users.map(user => (
                      <motion.tr 
                        key={user.id} 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-white/2 transition-colors group"
                      >
                        {/* User Cell */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 rounded-full border border-white/10 overflow-hidden bg-white/5 flex items-center justify-center">
                              {user.profilePic ? (
                                <img src={user.profilePic} alt="avatar" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-gray-400 text-sm font-semibold">
                                  {(user.displayName || user.username).charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-white flex items-center gap-1">
                                {user.displayName || user.username}
                                {user.isVerified && <BadgeCheck className="w-4 h-4 text-blue-500" />}
                              </div>
                              {user.displayName && (
                                <div className="text-xs text-gray-500">@{user.username}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role Cell */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                            user.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                          }`}>
                            {user.role}
                          </span>
                        </td>

                        {/* Status Cell */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.isBanned ? (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                              <XCircle className="w-4 h-4" /> Banned
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-green-400">
                              <CheckCircle className="w-4 h-4" /> Active
                            </span>
                          )}
                        </td>

                        {/* Actions Cell */}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                            <button
                              disabled={loadingUsers[user.id]}
                              onClick={() => handleUpdateStatus(user.id, { isVerified: !user.isVerified })}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                                user.isVerified 
                                  ? 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                                  : 'bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20'
                              }`}
                            >
                              <BadgeCheck className="w-4 h-4" />
                              {user.isVerified ? 'Unverify' : 'Verify'}
                            </button>
                            {user.role !== 'ADMIN' && (
                                <button
                                  disabled={loadingUsers[user.id]}
                                  onClick={() => handleUpdateStatus(user.id, { isBanned: !user.isBanned })}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                                    user.isBanned 
                                      ? 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-300 border border-gray-500/20'
                                      : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                                  }`}
                                >
                                  <Ban className="w-4 h-4" />
                                  {user.isBanned ? 'Unban' : 'Ban'}
                                </button>
                            )}
                          </div>
                        </td>

                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
