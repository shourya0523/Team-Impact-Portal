import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { spacing } from '@team-impact/ui-tokens';
import { transition } from './motion';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

export type SheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Modal bottom sheet. Esc or scrim click closes it. Under reduced motion it only fades. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const reduced = useReducedMotion();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="scrim"
            className="ti-scrim"
            data-testid="sheet-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={transition.small}
            onClick={onClose}
          />
          <div key="wrap" className="ti-sheet-wrap">
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className="ti-sheet"
              initial={{ opacity: 0, y: reduced ? 0 : spacing['3xl'] }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : spacing['3xl'] }}
              transition={transition.screen}
            >
              <Text as="h2" id={titleId} variant="display" size="sm">
                {title}
              </Text>
              {children}
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
