import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center space-y-8 max-w-xl">
        {/* Logo mark */}
        <div className="mx-auto h-12 w-12 rounded-xl bg-[#6366f1] flex items-center justify-center">
          <span className="text-white font-bold text-xl tracking-tight">K</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-[-0.03em] text-white">
            Welcome to Knot
          </h1>
          <p className="text-base text-[#888] max-w-md mx-auto leading-relaxed">
            Secure, fast, and beautifully minimal messaging — built for people who
            value clarity and precision.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/login"
            className="px-6 py-2.5 rounded-lg bg-white text-[#030303] text-sm font-medium hover:bg-[#e5e5e5] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-6 py-2.5 rounded-lg border border-[rgba(255,255,255,0.08)] text-sm font-medium text-[#888] hover:text-white hover:border-[rgba(255,255,255,0.15)] transition-all"
          >
            Create Account
          </Link>
        </div>
      </div>
    </main>
  );
}
