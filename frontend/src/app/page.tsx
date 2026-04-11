import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-black relative overflow-hidden">
      {/* Ambient background decoration */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[150px] pointer-events-none" />

      <div className="z-10 text-center space-y-8 w-full max-w-3xl glass-panel p-10 md:p-16 rounded-3xl border border-white/10 shadow-2xl">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-indigo-300 via-white to-purple-300">
          Welcome to Knot
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-xl mx-auto">
          The next-generation, secure, and blazing fast chatting platform designed with absolute precision.
        </p>
        <div className="flex justify-center gap-6 pt-6">
          <Link href="/login" className="px-8 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)]">
            Login
          </Link>
          <Link href="/register" className="px-8 py-3 rounded-full border border-white/20 text-white hover:bg-white/10 transition-colors">
            Register
          </Link>
        </div>
      </div>
    </main>
  );
}
