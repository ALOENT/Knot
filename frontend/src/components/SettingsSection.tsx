import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, User, Mail, Shield, Bell, Moon, LogOut, CheckCircle } from 'lucide-react';
import { useChat } from '@/providers/ChatProvider';
import { api } from '@/lib/api';

export default function SettingsSection() {
  const { currentUser, setCurrentUser } = useChat();
  
  const [formData, setFormData] = useState({
    username: currentUser?.username || '',
    displayName: currentUser?.displayName || '',
    bio: currentUser?.bio || '',
    profilePic: currentUser?.profilePic || '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dismissTimeoutRef = useRef<number | null>(null);

  // Cleanup dismiss timeout on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current !== null) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        username: currentUser.username || prev.username,
        displayName: currentUser.displayName || prev.displayName,
        bio: currentUser.bio || prev.bio,
        profilePic: currentUser.profilePic || prev.profilePic,
      }));
    }
  }, [currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    try {
      const { data } = await api.put('/users/profile', {
        username: formData.username,
        displayName: formData.displayName,
        bio: formData.bio,
        profilePic: formData.profilePic,
      });
      if (data.success) {
        // Update context with new user info so UI refreshes without reload
        if (data.user) {
          setCurrentUser(data.user);
        }
        setMessageType('success');
        setMessage('Profile updated successfully!');
        // Auto-dismiss success message after 3 seconds
        if (dismissTimeoutRef.current !== null) {
          clearTimeout(dismissTimeoutRef.current);
        }
        dismissTimeoutRef.current = window.setTimeout(() => {
          setMessage('');
          dismissTimeoutRef.current = null;
        }, 3000);
      }
    } catch (error: any) {
      setMessageType('error');
      setMessage(error.response?.data?.message || 'Error updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-(--background) overflow-y-auto">
      {/* Header */}
      <div className="flex px-8 py-6 items-center justify-between border-b border-white/5 bg-white/1">
        <h2 className="text-2xl font-semibold text-white tracking-tight">Settings</h2>
      </div>

      <div className="p-8 max-w-4xl w-full mx-auto space-y-12 pb-20">
        
        {/* Profile Section */}
        <section className="space-y-6">
          <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">Profile</h3>
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
            
            {/* Avatar Upload Placeholder */}
            <div className="flex flex-col items-center gap-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      setMessage('File size must be less than 5MB');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      if (typeof reader.result === 'string') {
                        setFormData(prev => ({ ...prev, profilePic: reader.result as string }));
                      }
                    };
                    reader.onerror = () => {
                      setMessage('Error reading file. Please try a different image.');
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div 
                 className="relative group cursor-pointer" 
                 onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-28 h-28 rounded-full overflow-hidden bg-white/5 border border-white/10 relative">
                  {formData.profilePic ? (
                    <img src={formData.profilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <User size={40} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="text-white" size={24} />
                  </div>
                </div>
              </div>
              <span className="text-xs text-white/40">Click to update</span>
            </div>

            {/* Profile Form */}
            <div className="flex-1 space-y-4 w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">Display Name</label>
                  <input 
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleChange}
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500/50 focus:bg-white/10 transition-colors"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm text-white/60">@Username</label>
                  <input 
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500/50 focus:bg-white/10 transition-colors"
                    placeholder="johndoe"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-white/60">Bio</label>
                <textarea 
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500/50 focus:bg-white/10 transition-colors resize-none h-24"
                  placeholder="Tell us about yourself..."
                />
              </div>

              {message && (
                <motion.p 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-sm flex items-center gap-2 ${messageType === 'success' ? 'text-green-400' : 'text-red-400'}`}
                >
                  {messageType === 'success' && <CheckCircle size={14} />}
                  {message}
                </motion.p>
              )}

              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </section>

        {/* Divider */}
        <hr className="border-white/5" />

        {/* App Settings Section */}
        <section className="space-y-6">
          <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">App Preferences</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Setting Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Bell size={20} />
                </div>
                <div>
                  <h4 className="text-white text-sm font-medium">Desktop Notifications</h4>
                  <p className="text-white/40 text-xs">Receive alerts for new messages</p>
                </div>
              </div>
              <div 
                className={`w-10 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors ${notificationsEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                role="switch"
                aria-checked={notificationsEnabled}
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setNotificationsEnabled(!notificationsEnabled); }}
                tabIndex={0}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${notificationsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Moon size={20} />
                </div>
                <div>
                  <h4 className="text-white text-sm font-medium">Dark Mode</h4>
                  <p className="text-white/40 text-xs">Always use deep blue theme</p>
                </div>
              </div>
              <div 
                className={`w-10 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors ${darkModeEnabled ? 'bg-blue-600' : 'bg-gray-600'}`}
                role="switch"
                aria-checked={darkModeEnabled}
                onClick={() => setDarkModeEnabled(!darkModeEnabled)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDarkModeEnabled(!darkModeEnabled); }}
                tabIndex={0}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${darkModeEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
}
