import { Variants } from 'framer-motion';

export const pageVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 10 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -10,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 350, damping: 25 },
  },
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 16,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

export const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.13, ease: 'easeOut' } },
  exit: { opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.1, ease: 'easeIn' } },
};

export const collapseVariants = {
  initial: { height: 0, opacity: 0 },
  animate: {
    height: 'auto',
    opacity: 1,
    transition: { duration: 0.25, ease: [0.04, 0.62, 0.23, 0.98] as any },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: { duration: 0.2, ease: [0.04, 0.62, 0.23, 0.98] as any },
  },
};

export const sidebarVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const titlebarVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export const checkVariants: Variants = {
  hidden: { scale: 0, opacity: 0 },
  show: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
  exit: { scale: 0, opacity: 0, transition: { duration: 0.12 } },
};

export const tooltipVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85, y: 15 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', damping: 22, stiffness: 300 },
  },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.1 } },
};

export const colorPickerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -10 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.15, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.95, y: -10, transition: { duration: 0.1 } },
};

export const badgeVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', damping: 20, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
};

export const explorerVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', damping: 20, stiffness: 300 } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 380, damping: 24 },
  },
  exit: { opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.15 } },
};
