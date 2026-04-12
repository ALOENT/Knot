'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import Link from 'next/link';
import { User, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.4, 0.25, 1] } },
};

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/register', { username, email, password });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
        className="relative w-full max-w-[400px]"
      >
        {/* Border-beam card */}
        <div className="border-beam">
          <div
            className="relative z-[1] rounded-2xl p-8"
            style={{ background: 'rgba(8, 8, 8, 0.9)' }}
          >
            <motion.div variants={stagger} initial="hidden" animate="show">
              {/* Header */}
              <motion.div variants={fadeUp} className="text-center mb-7">
                <div className="mx-auto mb-4 h-10 w-10 rounded-lg bg-[#6366f1] flex items-center justify-center">
                  <span className="text-white font-bold text-base">K</span>
                </div>
                <h1 className="text-xl font-semibold tracking-[-0.02em] text-white">
                  Create your account
                </h1>
                <p className="mt-1.5 text-sm text-[#666]">
                  Join Knot and start connecting
                </p>
              </motion.div>

              {/* Error */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mb-5"
                  >
                    <div className="flex items-center gap-2 rounded-lg bg-red-500/[0.06] border border-red-500/10 px-3 py-2.5">
                      <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span className="text-xs text-red-300">{error}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handleRegister}>
                <motion.div variants={fadeUp} className="space-y-4">
                  {/* Username */}
                  <div>
                    <label
                      htmlFor="register-username"
                      className="block text-xs font-medium text-[#555] mb-1.5 tracking-wide"
                    >
                      Username
                    </label>
                    <div className="relative">
                      <User
                        className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-150 ${
                          focusedField === 'username' ? 'text-[#818cf8]' : 'text-[#444]'
                        }`}
                      />
                      <input
                        id="register-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onFocus={() => setFocusedField('username')}
                        onBlur={() => setFocusedField(null)}
                        className="input-field pl-10"
                        placeholder="Choose a username"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="register-email"
                      className="block text-xs font-medium text-[#555] mb-1.5 tracking-wide"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail
                        className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-150 ${
                          focusedField === 'email' ? 'text-[#818cf8]' : 'text-[#444]'
                        }`}
                      />
                      <input
                        id="register-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        className="input-field pl-10"
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="register-password"
                      className="block text-xs font-medium text-[#555] mb-1.5 tracking-wide"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-150 ${
                          focusedField === 'password' ? 'text-[#818cf8]' : 'text-[#444]'
                        }`}
                      />
                      <input
                        id="register-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        className="input-field pl-10"
                        placeholder="Min. 6 characters"
                        autoComplete="new-password"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Submit */}
                <motion.div variants={fadeUp} className="mt-6">
                  <button
                    id="register-submit"
                    type="submit"
                    disabled={loading}
                    className="btn-primary gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </motion.div>
              </form>

              {/* Footer */}
              <motion.p
                variants={fadeUp}
                className="mt-6 text-center text-xs text-[#555]"
              >
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-[#818cf8] hover:text-[#a5b4fc] transition-colors font-medium"
                >
                  Sign in
                </Link>
              </motion.p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
