'use client';

import { useEffect, useCallback, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * Physics-based cursor glow with spring-lag effect.
 * Three concentric layers with mix-blend-mode for depth.
 * Primary: #6366f1 (indigo-500), Secondary: #a855f7 (purple-500)
 */
export default function CursorGlow() {
  const mouseX = useMotionValue(-600);
  const mouseY = useMotionValue(-600);
  const isVisible = useMotionValue(0);

  // Heavy spring — intentional lag behind the cursor for 'soul'
  const primarySpring = { damping: 20, stiffness: 90, mass: 0.8 };
  const primaryX = useSpring(mouseX, primarySpring);
  const primaryY = useSpring(mouseY, primarySpring);

  // Medium spring — middle layer follows a touch faster
  const secondarySpring = { damping: 25, stiffness: 140, mass: 0.5 };
  const secondaryX = useSpring(mouseX, secondarySpring);
  const secondaryY = useSpring(mouseY, secondarySpring);

  // Light spring — tight core reacts quickest but still lags
  const coreSpring = { damping: 30, stiffness: 200, mass: 0.3 };
  const coreX = useSpring(mouseX, coreSpring);
  const coreY = useSpring(mouseY, coreSpring);

  // Subtle scale pulse based on mouse velocity
  const velocityX = useMotionValue(0);
  const velocityY = useMotionValue(0);
  const lastPos = useRef({ x: 0, y: 0, time: Date.now() });

  const coreScale = useSpring(1, { damping: 20, stiffness: 300 });

  const opacity = useSpring(isVisible, { damping: 30, stiffness: 200 });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const now = Date.now();
      const dt = Math.max(now - lastPos.current.time, 1);
      const vx = Math.abs(e.clientX - lastPos.current.x) / dt;
      const vy = Math.abs(e.clientY - lastPos.current.y) / dt;
      const speed = Math.sqrt(vx * vx + vy * vy);

      lastPos.current = { x: e.clientX, y: e.clientY, time: now };

      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      isVisible.set(1);

      // Scale up slightly when moving fast
      coreScale.set(1 + Math.min(speed * 0.3, 0.25));
    },
    [mouseX, mouseY, isVisible, coreScale],
  );

  const handleMouseLeave = useCallback(() => isVisible.set(0), [isVisible]);
  const handleMouseEnter = useCallback(() => isVisible.set(1), [isVisible]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [handleMouseMove, handleMouseLeave, handleMouseEnter]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
      style={{ mixBlendMode: 'screen' }}
    >
      {/* Layer 1 — Outer diffuse indigo halo */}
      <motion.div
        style={{
          x: primaryX,
          y: primaryY,
          translateX: '-50%',
          translateY: '-50%',
          opacity,
        }}
        className="absolute left-0 top-0 h-[44rem] w-[44rem] rounded-full will-change-transform"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              'radial-gradient(circle at center, rgba(99,102,241,0.10) 0%, rgba(99,102,241,0.04) 30%, rgba(168,85,247,0.02) 55%, transparent 70%)',
          }}
        />
      </motion.div>

      {/* Layer 2 — Mid-range purple bloom */}
      <motion.div
        style={{
          x: secondaryX,
          y: secondaryY,
          translateX: '-50%',
          translateY: '-50%',
          opacity,
        }}
        className="absolute left-0 top-0 h-[26rem] w-[26rem] rounded-full will-change-transform"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              'radial-gradient(circle at center, rgba(168,85,247,0.12) 0%, rgba(99,102,241,0.06) 40%, transparent 70%)',
            mixBlendMode: 'overlay',
          }}
        />
      </motion.div>

      {/* Layer 3 — Hot core with velocity-driven scale */}
      <motion.div
        style={{
          x: coreX,
          y: coreY,
          translateX: '-50%',
          translateY: '-50%',
          scale: coreScale,
          opacity,
        }}
        className="absolute left-0 top-0 h-[14rem] w-[14rem] rounded-full will-change-transform"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              'radial-gradient(circle at center, rgba(99,102,241,0.18) 0%, rgba(168,85,247,0.08) 45%, transparent 70%)',
          }}
        />
      </motion.div>
    </div>
  );
}
