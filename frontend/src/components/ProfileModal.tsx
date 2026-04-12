import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Calendar, LogOut, X } from 'lucide-react';
import type { AuthUser } from '@/providers/ChatProvider';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onLogout: () => void;
}

export default function ProfileModal({ isOpen, onClose, user, onLogout }: ProfileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      closeButtonRef.current?.focus();
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTabKey);
    return () => modal.removeEventListener('keydown', handleTabKey);
  }, [isOpen]);

  const getStatusLabel = () => {
    if (!user) return 'Unknown';
    return user.isOnline ? 'Online' : 'Offline';
  };

  const getStatusColor = () => {
    if (!user) return 'bg-gray-500';
    return user.isOnline ? 'bg-green-500' : 'bg-gray-500';
  };

  return (
    <AnimatePresence>
      {isOpen && user && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm z-[101] overflow-hidden rounded-2xl border border-white/10"
            style={{
              background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(15,15,20,0.95) 100%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div className="h-24 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 relative">
              <button
                ref={closeButtonRef}
                onClick={onClose}
                aria-label="Close profile modal"
                className="absolute top-3 right-3 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 pb-6 relative pt-12">
              <div className="absolute -top-10 left-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] shadow-xl">
                  <div className="w-full h-full bg-black rounded-2xl flex items-center justify-center overflow-hidden">
                    {user.profilePic ? (
                      <img src={user.profilePic} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-white uppercase">{user.username.charAt(0)}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-2 text-white">
                <h2 id="profile-modal-title" className="text-xl font-bold">{user.username}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor()} shadow-[0_0_8px_rgba(34,197,94,0.5)]`} />
                  <span className="text-xs text-gray-400 font-medium">{getStatusLabel()}</span>
                </div>
              </div>
              
              {user.bio && (
                <p className="mt-4 text-sm text-gray-400 italic">"{user.bio}"</p>
              )}

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                  <Mail className="w-5 h-5 text-gray-500" />
                  <span className="text-sm text-gray-300">{user.email}</span>
                </div>
                {user.createdAt && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-300">Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="mt-8">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors font-medium text-sm border border-red-500/20"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
