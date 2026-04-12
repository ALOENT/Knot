'use client';

import { useEffect, useCallback, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { usePathname } from 'next/navigation';

/**
 * Soft, low-opacity cursor glow — ONLY renders on auth pages (/login, /register).
 * Uses high-inertia spring physics for a smooth, non-glitchy follow.
 * Single layer: white/indigo radial gradient, mix-blend-mode: screen.
 */
export default function CursorGlow() {
  const pathname = usePathname();

  // Only render on auth pages
  const isAuthPage =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname === '/';

  const mouseX = useMotionValue(-400);
  const mouseY = useMotionValue(-400);
  const opacity = useMotionValue(0);

  // High-inertia spring — slow, smooth, no jitter
  const springConfig = { damping: 25, stiffness: 60, mass: 1.2 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);
  const smoothOpacity = useSpring(opacity, { damping: 30, stiffness: 200 });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      opacity.set(1);
    },
    [mouseX, mouseY, opacity],
  );

  const handleMouseLeave = useCallback(() => opacity.set(0), [opacity]);
  const handleMouseEnter = useCallback(() => opacity.set(1), [opacity]);

  useEffect(() => {
    if (!isAuthPage) return;

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isAuthPage, handleMouseMove, handleMouseLeave, handleMouseEnter]);

  // Don't render anything on non-auth pages
  if (!isAuthPage) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
      style={{ mixBlendMode: 'screen' }}
    >
      <motion.div
        style={{
          x,
          y,
          translateX: '-50%',
          translateY: '-50%',
          opacity: smoothOpacity,
        }}
        className="absolute left-0 top-0 will-change-transform"
      >
        <div
          style={{
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at center, rgba(255,255,255,0.04) 0%, rgba(99,102,241,0.025) 35%, transparent 70%)',
          }}
        />
      </motion.div>
    </div>
  );
}
