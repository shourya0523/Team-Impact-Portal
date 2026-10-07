import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { spacing } from '@team-impact/ui-tokens';
import { transition } from './motion';
import { useReducedMotion } from './useReducedMotion';

/** Fade and slide up on mount. Under reduced motion the slide is dropped and only the fade stays. */
export function FadeSlideIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : spacing.md }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition.screen, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
