'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, BadgeCheck } from 'lucide-react';
import { api } from '@/lib/api';

interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  profilePic: string | null;
  banner: string | null;
  isOnline: boolean;
  lastSeen: string;
  isVerified: boolean;
  createdAt: string;
}

interface UserProfilePanelProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfilePanel({ userId, isOpen, onClose }: UserProfilePanelProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      setError('');
      api.get(`/users/${userId}`)
        .then(res => {
          setProfile(res.data.user);
        })
        .catch(err => {
          setError(err.response?.data?.message || 'Failed to load profile');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, userId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-80 bg-[#0a0a0c] border-l border-white/10 shadow-2xl overflow-y-auto"
          >
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={onClose}
                className="btn-icon h-8 w-8 bg-black/40 hover:bg-black/60 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="typing-dots"><span /><span /><span /></div>
              </div>
            ) : error ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-400">
                <X className="w-12 h-12 text-red-500/50 mb-4" />
                <p>{error}</p>
              </div>
            ) : profile ? (
              <div className="flex flex-col">
                <div className="relative h-40 bg-indigo-900/40">
                  {profile.banner && (
                    <img src={profile.banner} alt="Banner" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute -bottom-12 left-6">
                    <div className="h-24 w-24 rounded-full border-4 border-[#0a0a0c] overflow-hidden bg-white/5">
                      {profile.profilePic ? (
                        <img src={profile.profilePic} alt={profile.displayName || profile.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-gray-500 bg-white/10">
                          {(profile.displayName || profile.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-16 px-6 pb-6 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      {profile.displayName || profile.username}
                      {profile.isVerified && <BadgeCheck className="w-5 h-5 text-blue-500" />}
                    </h2>
                    <p className="text-sm text-gray-500">@{profile.username}</p>
                  </div>

                  {profile.bio && (
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">ABOUT</h4>
                      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                    </div>
                  )}

                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
