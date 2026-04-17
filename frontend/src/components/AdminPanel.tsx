import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, Users, Activity, Ban, CheckCircle, XCircle, 
  BadgeCheck, X, Search, Flag, AlertTriangle, Eye, ArrowRight 
} from 'lucide-react';
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

interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  contextMessages: any[];
  status: 'PENDING' | 'RESOLVED';
  createdAt: string;
  reporter: {
    username: string;
    displayName: string | null;
    profilePic: string | null;
  };
  reportedUser: {
    username: string;
    displayName: string | null;
    profilePic: string | null;
  };
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

// Static class mapping for Tailwind JIT compatibility
const STAT_COLORS = {
  indigo: {
    card: 'bg-indigo-600/5 border-indigo-500/10',
    iconWrapper: 'bg-indigo-500/10 text-indigo-400',
  },
  blue: {
    card: 'bg-blue-600/5 border-blue-500/10',
    iconWrapper: 'bg-blue-500/10 text-blue-400',
  },
  red: {
    card: 'bg-red-600/5 border-red-500/10',
    iconWrapper: 'bg-red-500/10 text-red-400',
  }
};

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'reports'>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<Stats>({ totalAgents: 0, activeConversations: 0, bannedEntities: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState<Record<string, boolean>>({});
  const [resolvingReports, setResolvingReports] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  
  const lastFetchAtRef = useRef<number>(0);

  const fetchUsers = useCallback(async (isSearch = false) => {
    const now = Date.now();
    // Guard: Prevent duplicate calls if they are within 100ms (useful for opening panel + initial search)
    if (!isSearch && now - lastFetchAtRef.current < 100) return;
    
    try {
      setIsLoading(true);
      setFetchError(null);
      lastFetchAtRef.current = now;
      const res = await api.get(`/admin/users?search=${encodeURIComponent(searchTerm)}`);
      if (res.data.success) {
        setUsers(res.data.data.users);
        setStats(res.data.data.stats);
      }
    } catch (error) {
      setFetchError('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  const fetchReports = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchAtRef.current < 100) return;

    try {
      setIsLoading(true);
      setFetchError(null);
      lastFetchAtRef.current = now;
      const res = await api.get('/admin/reports');
      if (res.data.success) {
        setReports(res.data.data);
      }
    } catch (error) {
      setFetchError('Failed to fetch reports');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (!isOpen || activeTab !== 'users') return;
    
    const timer = setTimeout(() => {
      fetchUsers(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, activeTab, fetchUsers]);

  // Initial load or tab switch
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'users') fetchUsers();
      else fetchReports();
    }
  }, [isOpen, activeTab, fetchUsers, fetchReports]);

  const hasPendingReports = useMemo(() => reports.some(r => r.status === 'PENDING'), [reports]);

  const handleUpdateStatus = async (userId: string, updates: { isBanned?: boolean; isVerified?: boolean }) => {
    if (loadingUsers[userId]) return;
    
    try {
      setLoadingUsers(prev => ({ ...prev, [userId]: true }));
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...updates } : u)));
      
      const res = await api.put('/admin/update-status', { userId, ...updates });
      
      if (res.data.success) {
        const updatedUser = res.data.data;
        setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...updatedUser } : u)));
      } else {
        fetchUsers(true);
        setFetchError(res.data.message || 'Update failed');
      }
    } catch (error) {
      fetchUsers(true);
      setFetchError('Update failed');
    } finally {
      setLoadingUsers(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleResolveReport = async (reportId: string) => {
    if (resolvingReports[reportId]) return;

    try {
      setResolvingReports(prev => ({ ...prev, [reportId]: true }));
      const res = await api.put(`/admin/reports/${reportId}/resolve`);
      if (res.data.success) {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'RESOLVED' } : r));
        if (selectedReport?.id === reportId) {
          setSelectedReport(prev => prev ? { ...prev, status: 'RESOLVED' } : null);
        }
      }
    } catch (error) {
      setFetchError('Failed to resolve report');
    } finally {
      setResolvingReports(prev => ({ ...prev, [reportId]: false }));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0c] text-white overflow-hidden"
        >
          {/* Header */}
          <div className="flex px-4 md:px-8 py-5 md:py-6 items-center justify-between border-b border-white/5 bg-white/1 shrink-0">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 md:h-6 md:w-6 text-indigo-500" />
              <h2 className="text-lg md:text-2xl font-bold tracking-tight">Admin</h2>
            </div>

            {/* Tab System - Compact on mobile */}
            <div className="flex bg-white/5 p-1 rounded-xl gap-0.5">
              {(['users', 'reports'] as const).map((tabId) => {
                const isUsers = tabId === 'users';
                const Icon = isUsers ? Users : Flag;
                const badge = !isUsers && hasPendingReports;

                return (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    className={`relative flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                      activeTab === tabId ? 'text-white' : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {activeTab === tabId && (
                      <motion.div
                        layoutId="tab-bg"
                        className="absolute inset-0 bg-indigo-600 rounded-lg shadow-[0_2px_10px_rgba(79,70,229,0.3)]"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      <span className="hidden sm:inline">{isUsers ? 'Users' : 'Reports'}</span>
                      {badge && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse border border-[#0a0a0c]" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <button 
              onClick={onClose} 
              className="p-2 -mr-1 rounded-xl hover:bg-white/5 transition-colors text-gray-400 active:scale-95"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto w-full max-w-7xl mx-auto space-y-6 md:space-y-8 p-4 md:p-8 pb-32">

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Total Agents', value: stats.totalAgents, icon: ShieldCheck, color: 'indigo' as const },
                { label: 'Active Chats', value: stats.activeConversations, icon: Activity, color: 'blue' as const },
                { label: 'Banned Entities', value: stats.bannedEntities, icon: Ban, color: 'red' as const }
              ].map((stat, i) => {
                const theme = STAT_COLORS[stat.color];
                return (
                  <div key={i} className={`${theme.card} border rounded-2xl p-6 flex items-center gap-4`}>
                    <div className={`p-3 ${theme.iconWrapper} rounded-xl`}>
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {fetchError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-sm">
                <AlertTriangle className="w-4 h-4" />
                {fetchError}
              </div>
            )}

            {/* Main Content Area */}
            <div className="bg-white/1 border border-white/5 rounded-2xl overflow-hidden shadow-2xl min-h-[500px]">
              <AnimatePresence mode="wait">
                {activeTab === 'users' ? (
                  <motion.div
                    key="users"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex flex-col h-full"
                  >
                    {/* Search Bar */}
                    <div className="p-6 border-b border-white/5 bg-white/2">
                      <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Search username, display name, or email..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full bg-[#0a0a0c] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-white/2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          <tr>
                            <th className="px-6 py-4">User Details</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Security Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                          {users.map(user => (
                            <tr key={user.id} className="hover:bg-white/2 group">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center overflow-hidden border border-white/10">
                                    {user.profilePic ? (
                                      <img 
                                        src={user.profilePic} 
                                        alt={user.displayName || user.username || 'User profile'} 
                                        className="w-full h-full object-cover" 
                                      />
                                    ) : (
                                      <span className="text-gray-500 font-bold uppercase">{user.username[0]}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-medium flex items-center gap-1.5">
                                      {user.displayName || user.username}
                                      {user.isVerified && <BadgeCheck className="w-4 h-4 text-blue-400" />}
                                    </div>
                                    <div className="text-xs text-gray-500">@{user.username}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider ${
                                  user.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-gray-500/10 text-gray-400'
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                {user.isBanned ? (
                                  <span className="text-red-400 flex items-center gap-1.5 font-medium">
                                    <XCircle className="w-4 h-4" /> Banned
                                  </span>
                                ) : (
                                  <span className="text-green-400 flex items-center gap-1.5 font-medium">
                                    <CheckCircle className="w-4 h-4" /> Authorized
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleUpdateStatus(user.id, { isVerified: !user.isVerified })}
                                    className={`p-2 rounded-lg border transition-colors ${
                                      user.isVerified ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-blue-600/10 border-blue-500/20 text-blue-400'
                                    }`}
                                    title={user.isVerified ? 'Unverify User' : 'Verify User'}
                                  >
                                    <BadgeCheck className="w-4 h-4" />
                                  </button>
                                  {user.role !== 'ADMIN' && (
                                    <button
                                      onClick={() => handleUpdateStatus(user.id, { isBanned: !user.isBanned })}
                                      className={`p-2 rounded-lg border transition-colors ${
                                        user.isBanned ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
                                      }`}
                                      title={user.isBanned ? 'Unban User' : 'Ban User'}
                                    >
                                      <Ban className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="reports"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col h-full p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                       <h3 className="text-lg font-semibold flex items-center gap-2">
                         <Flag className="w-5 h-5 text-indigo-400" />
                         User Reports
                       </h3>
                       {hasPendingReports && (
                         <span className="bg-red-500/10 text-red-400 text-[10px] font-bold px-2 py-1 rounded border border-red-500/20">
                           {reports.filter(r => r.status === 'PENDING').length} NEW REPORTS
                         </span>
                       )}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {reports.length === 0 ? (
                        <div className="py-20 text-center text-gray-500">
                           <Flag className="w-8 h-8 mx-auto mb-3 opacity-20" />
                           <p>No active reports in the database</p>
                        </div>
                      ) : (
                        reports.map(report => (
                          <div 
                            key={report.id} 
                            className={`p-4 rounded-xl border transition-all ${
                              report.status === 'PENDING' 
                                ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/30' 
                                : 'bg-white/2 border-white/5 opacity-60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-6 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Reporter</span>
                                  <span className="text-sm font-medium">{report.reporter.displayName || report.reporter.username}</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-700" />
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-red-500/60 font-bold uppercase tracking-widest">Reported</span>
                                  <span className="text-sm font-medium">{report.reportedUser.displayName || report.reportedUser.username}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => setSelectedReport(report)}
                                  className="btn-icon h-9 w-9 bg-indigo-500/10 text-indigo-400"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                {report.status === 'PENDING' && (
                                  <button 
                                    onClick={() => handleResolveReport(report.id)}
                                    disabled={resolvingReports[report.id]}
                                    className="px-4 py-2 bg-green-600/10 border border-green-500/20 text-green-400 rounded-lg text-xs font-bold hover:bg-green-600/20 transition-all disabled:opacity-50"
                                  >
                                    {resolvingReports[report.id] ? '...' : 'RESOLVE'}
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 text-xs text-gray-400 flex items-center gap-2">
                               <Flag className="w-3.5 h-3.5" />
                               <span className="font-semibold text-gray-300">Reason:</span> {report.reason}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Report Context Modal */}
          <AnimatePresence>
            {selectedReport && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
              >
                <motion.div 
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-[#0f0f12] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-3xl"
                >
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold">Investigation Context</h4>
                      <p className="text-xs text-gray-500">Last {selectedReport.contextMessages.length} messages snapshot</p>
                    </div>
                    <button onClick={() => setSelectedReport(null)} className="btn-icon">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
                    {selectedReport.contextMessages.map((msg: any) => (
                      <div key={msg.id} className={`flex flex-col ${msg.senderId === selectedReport.reportedUserId ? 'items-end' : 'items-start'}`}>
                         <span className="text-[10px] text-gray-600 mb-1">
                           {msg.senderId === selectedReport.reportedUserId ? 'Reported User' : 'Reporter'}
                         </span>
                         <div className={`px-4 py-2 rounded-xl text-sm ${
                           msg.senderId === selectedReport.reportedUserId 
                             ? 'bg-red-500/10 border border-red-500/20 text-red-100' 
                             : 'bg-white/5 border border-white/10 text-gray-300'
                         }`}>
                           {msg.content}
                         </div>
                      </div>
                    ))}
                    {selectedReport.contextMessages.length === 0 && (
                      <p className="text-center text-gray-500 py-10">No chat context captured.</p>
                    )}
                  </div>
                  <div className="p-6 border-t border-white/5 bg-white/1 flex justify-end">
                    <button 
                       onClick={() => setSelectedReport(null)}
                       className="px-6 py-2 bg-indigo-600 rounded-xl font-bold text-sm tracking-wide"
                    >
                      CLOSE PREVIEW
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
