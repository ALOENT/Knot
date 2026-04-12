'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import Link from 'next/link';
import { User, Mail, Lock, ArrowRight, AlertCircle, Loader2, Sparkles } from 'lucide-react';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.12 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.4, 0.25, 1] } },
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
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      {/* Ambient background orbs */}
      <div className="orb top-[15%] right-[18%] w-[30rem] h-[30rem] bg-violet-600/[0.07]" />
      <div className="orb bottom-[20%] left-[12%] w-[28rem] h-[28rem] bg-fuchsia-600/[0.06]" />
      <div className="orb top-[50%] right-[40%] w-[20rem] h-[20rem] bg-indigo-600/[0.04]" />

      {/* Subtle noise texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="glass-panel rounded-2xl p-8 md:p-10">
          <motion.div variants={container} initial="hidden" animate="show">
            {/* Header */}
            <motion.div variants={item} className="text-center mb-8">
              <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Sparkles className="h-5 w-5 text-violet-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Create your account
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                Join Knot and start connecting
              </p>
            </motion.div>

            {/* Error */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="mb-6"
                >
                  <div className="flex items-center gap-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/15 px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                    <span className="text-sm text-red-300">{error}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleRegister}>
              <motion.div variants={item} className="space-y-4">
                {/* Username */}
                <div className="relative group">
                  <label
                    htmlFor="register-username"
                    className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <User
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${
                        focusedField === 'username' ? 'text-violet-400' : 'text-gray-500'
                      }`}
                    />
                    <input
                      id="register-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      className="input-field pl-11"
                      placeholder="Choose a username"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="relative group">
                  <label
                    htmlFor="register-email"
                    className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${
                        focusedField === 'email' ? 'text-violet-400' : 'text-gray-500'
                      }`}
                    />
                    <input
                      id="register-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      className="input-field pl-11"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="relative group">
                  <label
                    htmlFor="register-password"
                    className="block text-xs font-medium text-gray-400 mb-1.5 tracking-wide uppercase"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-200 ${
                        focusedField === 'password' ? 'text-violet-400' : 'text-gray-500'
                      }`}
                    />
                    <input
                      id="register-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      className="input-field pl-11"
                      placeholder="Min. 6 characters"
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
              </motion.div>

              {/* Submit */}
              <motion.div variants={item} className="mt-7">
                <button
                  id="register-submit"
                  type="submit"
                  disabled={loading}
                  className="btn-primary group flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Create Account
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </motion.div>
            </form>

            {/* Footer link */}
            <motion.p
              variants={item}
              className="mt-8 text-center text-sm text-gray-500"
            >
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-violet-400 hover:text-violet-300 transition-colors duration-200 font-medium"
              >
                Sign in
              </Link>
            </motion.p>
          </motion.div>
        </div>

        {/* Decorative bottom shine */}
        <div className="absolute -bottom-px left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
      </motion.div>
    </div>
  );
}
