// A complex modal used for onboarding/tutorials.
// It uses getBoundingClientRect() to automatically position itself pointing at specific elements on the screen.
// We disable scrolling on the body while this is open so the user doesn't mess up the anchor positioning.

import { AnimatePresence, motion } from 'framer-motion';
import { X, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';

export type TutorialStep = {
  title: string;
  description: React.ReactNode;
  image?: string;
  highlights?: { top: number; left: number; width: number; height: number }[]; // In percentages
  target?: string; // CSS Selector for a UI element to point at
  placement?: 'auto' | 'left-screen' | 'bottom-screen';
  hideHeader?: boolean; // Force the header to hide for compact steps
  hideImage?: boolean; // Hide the inline image but provide a button to view it
  primaryButtonText?: string;
  secondaryButtonText?: string | null;
  skipButtonText?: string;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  onSkipClick?: () => void;
  onEnter?: () => void; // Triggered when step becomes active
  hideDots?: boolean; // Hides the progress dots for branching flows
};

interface TutorialModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  steps: TutorialStep[];
  currentStep?: number;
  onStepChange?: (step: number) => void;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const rectsAreClose = (a: DOMRect, b: DOMRect) =>
  Math.abs(a.top - b.top) < 1 &&
  Math.abs(a.left - b.left) < 1 &&
  Math.abs(a.width - b.width) < 1 &&
  Math.abs(a.height - b.height) < 1;

const isComfortablyVisible = (rect: DOMRect, padding = 20) => {
  const fitsVertically = rect.height <= window.innerHeight - padding * 2;
  const fitsHorizontally = rect.width <= window.innerWidth - padding * 2;

  return (
    (!fitsVertically || (rect.top >= padding && rect.bottom <= window.innerHeight - padding)) &&
    (!fitsHorizontally || (rect.left >= padding && rect.right <= window.innerWidth - padding))
  );
};

const getExpandedRect = (rect: DOMRect, padding: number) => ({
  top: rect.top - padding,
  left: rect.left - padding,
  right: rect.right + padding,
  bottom: rect.bottom + padding,
  width: rect.width + padding * 2,
  height: rect.height + padding * 2,
});

const getOverlapArea = (
  a: { top: number; left: number; right: number; bottom: number },
  b: { top: number; left: number; right: number; bottom: number },
) => {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
};

const rectDelta = (a: DOMRect, b: DOMRect) =>
  Math.max(
    Math.abs(a.top - b.top),
    Math.abs(a.left - b.left),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height),
  );

const focusTargetElement = async (
  element: Element,
  isCancelled: () => boolean,
): Promise<DOMRect | null> => {
  const initialRect = element.getBoundingClientRect();
  const wideTarget = initialRect.width > window.innerWidth * 0.45;
  const block: ScrollLogicalPosition =
    wideTarget && initialRect.height + 360 < window.innerHeight
      ? 'end'
      : initialRect.height > window.innerHeight - 120
        ? 'start'
        : 'center';

  element.scrollIntoView({ behavior: 'smooth', block, inline: 'nearest' });

  let lastRect = element.getBoundingClientRect();
  let stableFrames = 0;
  const startedAt = performance.now();

  while (!isCancelled() && performance.now() - startedAt < 900) {
    await nextFrame();
    const nextRect = element.getBoundingClientRect();
    if (rectsAreClose(lastRect, nextRect)) {
      stableFrames += 1;
    } else {
      stableFrames = 0;
      lastRect = nextRect;
    }

    if (stableFrames >= 4 && isComfortablyVisible(nextRect)) {
      return nextRect;
    }
  }

  if (isCancelled()) return null;

  const settledRect = element.getBoundingClientRect();
  if (!isComfortablyVisible(settledRect)) {
    element.scrollIntoView({ behavior: 'auto', block, inline: 'nearest' });
    await nextFrame();
    await nextFrame();
  }

  return element.getBoundingClientRect();
};

export function TutorialModal({
  isOpen,
  onOpenChange,
  title,
  steps,
  currentStep: controlledStep,
  onStepChange,
}: TutorialModalProps) {
  const [internalStep, setInternalStep] = useState(0);
  const currentStep = controlledStep !== undefined ? controlledStep : internalStep;

  const setCurrentStep = (updater: number | ((c: number) => number)) => {
    const nextStep = typeof updater === 'function' ? updater(currentStep) : updater;
    if (onStepChange) onStepChange(nextStep);
    setInternalStep(nextStep);
  };

  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [targetState, setTargetState] = useState<{
    rect: DOMRect;
    step: number;
    target: string;
  } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      if (currentStep !== 0) setCurrentStep(0);
      if (enlargedImage) setEnlargedImage(null);
    }
  }, [isOpen]);

  const step = steps[currentStep];
  const targetRect =
    targetState?.step === currentStep && targetState.target === step?.target
      ? targetState.rect
      : null;
  const isTargetPending = Boolean(isOpen && step?.target && !targetRect);

  useEffect(() => {
    // Reset image loaded state when step changes
    setImageLoaded(false);

    // Call onEnter if defined
    if (isOpen && step?.onEnter) {
      step.onEnter();
    }
  }, [currentStep, step?.image, isOpen]);

  useEffect(() => {
    if (!isOpen || !step) return;

    if (step.target) {
      const target = step.target;
      let cancelled = false;
      let ready = false;

      const updateTarget = () => {
        if (!ready || cancelled) return;
        const currentEl = document.querySelector(target);
        if (currentEl) {
          const rect = currentEl.getBoundingClientRect();
          setTargetState((prev) => {
            if (
              prev?.step === currentStep &&
              prev.target === target &&
              rectDelta(prev.rect, rect) < 2
            ) {
              return prev;
            }

            return { rect, step: currentStep, target };
          });
        }
      };

      const focusTarget = async () => {
        setTargetState(null);

        let currentEl: Element | null = null;
        for (let attempt = 0; attempt < 20 && !cancelled; attempt += 1) {
          currentEl = document.querySelector(target);
          if (currentEl) break;
          await wait(50);
        }

        if (!currentEl || cancelled) return;

        const rect = await focusTargetElement(currentEl, () => cancelled);
        if (!rect || cancelled) return;

        ready = true;
        setTargetState({ rect, step: currentStep, target });
      };

      focusTarget();
      window.addEventListener('resize', updateTarget);
      const interval = setInterval(updateTarget, 500); // Poll for scroll/layout changes
      return () => {
        cancelled = true;
        window.removeEventListener('resize', updateTarget);
        clearInterval(interval);
      };
    } else {
      setTargetState(null);
    }
  }, [isOpen, step, currentStep]);

  // Prevent user scrolling while modal is open, but allow programmatic smooth scrolling
  useEffect(() => {
    if (!isOpen) return;

    // Disable pointer events on the app to prevent clicking and scrollbar dragging
    const style = document.createElement('style');
    style.innerHTML = `
      #root {
        pointer-events: none !important;
      }
      body {
        overflow: hidden; /* Hide main scrollbars just in case */
      }
    `;
    document.head.appendChild(style);

    const preventScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.tutorial-modal-content') && !target?.closest('.overflow-y-auto')) {
        e.preventDefault();
      }
    };

    const preventKeyScroll = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' '].includes(e.key)) {
        preventScroll(e);
      }
    };

    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('keydown', preventKeyScroll, { passive: false });

    return () => {
      document.head.removeChild(style);
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
      window.removeEventListener('keydown', preventKeyScroll);
    };
  }, [isOpen]);

  const modalStyle: React.CSSProperties = {};
  type ArrowDir = 'top' | 'bottom' | 'left' | 'right' | null;
  let arrowDir: ArrowDir = null;
  let shouldHideHeader = true;

  if (targetRect) {
    const viewportPadding = 16;
    const gutter = 16;
    const highlightPadding = 10;
    const modalWidth = Math.min(380, window.innerWidth - viewportPadding * 2);
    let estimatedHeight = 320;
    if (step?.hideImage) estimatedHeight -= 140;
    if (shouldHideHeader) estimatedHeight -= 60;
    // ensure estimated height doesn't fall below the modal's natural min height
    estimatedHeight = Math.max(estimatedHeight, 210);
    const maxTop = Math.max(
      viewportPadding,
      window.innerHeight - estimatedHeight - viewportPadding,
    );
    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), Math.max(min, max));

    const highlightedRect = getExpandedRect(targetRect, highlightPadding);
    const spaceRight = window.innerWidth - targetRect.right;
    const spaceLeft = targetRect.left;
    const spaceBelow = window.innerHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;
    const sidebarTarget = targetRect.left < 260 && targetRect.width <= 260;

    if (window.innerHeight < estimatedHeight + viewportPadding * 2) {
      shouldHideHeader = true;
    }

    modalStyle.position = 'fixed';
    modalStyle.width = modalWidth;
    modalStyle.maxHeight = `calc(100vh - ${viewportPadding * 2}px)`;

    const centeredLeft = clamp(
      targetRect.left + targetRect.width / 2 - modalWidth / 2,
      viewportPadding,
      window.innerWidth - modalWidth - viewportPadding,
    );
    const centeredTop = clamp(
      targetRect.top + targetRect.height / 2 - estimatedHeight / 2,
      viewportPadding,
      maxTop,
    );

    const forcedPosition =
      step.placement === 'left-screen'
        ? {
            arrow: 'right' as ArrowDir,
            left: viewportPadding,
            top: centeredTop,
          }
        : step.placement === 'bottom-screen'
          ? {
              arrow: 'top' as ArrowDir,
              left: centeredLeft,
              top: clamp(
                window.innerHeight - estimatedHeight - viewportPadding,
                viewportPadding,
                maxTop,
              ),
            }
          : null;

    const best = forcedPosition
      ? { ...forcedPosition, score: 0 }
      : [
          {
            arrow: 'top' as ArrowDir,
            left: centeredLeft,
            top: clamp(
              highlightedRect.bottom + gutter,
              viewportPadding,
              window.innerHeight - estimatedHeight - viewportPadding,
            ),
            rank: sidebarTarget ? 60 : 0,
            naturalSpace: spaceBelow,
          },
          {
            arrow: 'bottom' as ArrowDir,
            left: centeredLeft,
            top: clamp(
              highlightedRect.top - estimatedHeight - gutter,
              viewportPadding,
              window.innerHeight - estimatedHeight - viewportPadding,
            ),
            rank: sidebarTarget ? 70 : 8,
            naturalSpace: spaceAbove,
          },
          {
            arrow: 'left' as ArrowDir,
            left: clamp(
              highlightedRect.right + gutter,
              viewportPadding,
              window.innerWidth - modalWidth - viewportPadding,
            ),
            top: centeredTop,
            rank: sidebarTarget ? 0 : 16,
            naturalSpace: spaceRight,
          },
          {
            arrow: 'right' as ArrowDir,
            left: clamp(
              highlightedRect.left - modalWidth - gutter,
              viewportPadding,
              window.innerWidth - modalWidth - viewportPadding,
            ),
            top: centeredTop,
            rank: sidebarTarget ? 30 : 20,
            naturalSpace: spaceLeft,
          },
        ]
          .map((candidate) => {
            const candidateRect = {
              left: candidate.left,
              top: candidate.top,
              right: candidate.left + modalWidth,
              bottom: candidate.top + estimatedHeight,
            };
            const overlap = getOverlapArea(candidateRect, highlightedRect);
            const tightSpacePenalty = candidate.naturalSpace < estimatedHeight + gutter ? 80 : 0;
            const sideOnWideTargetPenalty =
              (candidate.arrow === 'left' || candidate.arrow === 'right') &&
              targetRect.width > window.innerWidth * 0.45 &&
              overlap > 0
                ? 200000
                : 0;
            return {
              ...candidate,
              score: overlap * 20 + sideOnWideTargetPenalty + tightSpacePenalty + candidate.rank,
            };
          })
          .reduce((winner, candidate) => (candidate.score < winner.score ? candidate : winner));

    const bestRect = {
      left: best.left,
      top: best.top,
      right: best.left + modalWidth,
      bottom: best.top + estimatedHeight,
    };

    modalStyle.left = Math.round(best.left);
    modalStyle.top = Math.round(best.top);
    arrowDir = getOverlapArea(bestRect, highlightedRect) > 0 ? null : best.arrow;
  } else {
    // Centered modal
    modalStyle.position = 'relative';
    modalStyle.width = 480;
    modalStyle.top = 0;
    modalStyle.left = 0;
    modalStyle.margin = 'auto';
  }

  const modalOverlay = (
    <div className="fixed inset-0 z-[200] pointer-events-none flex flex-col justify-center p-4">
      {/* Dim backdrop if no target */}
      {!targetRect && !isTargetPending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-[var(--bg-overlay)] pointer-events-auto"
          onClick={() => onOpenChange(false)}
        />
      )}

      {/* Target Highlight */}
      {targetRect && (
        <motion.div
          key={`${currentStep}-${step.target || 'target'}-spotlight`}
          initial={{
            opacity: 0,
            top: targetRect.top - 10,
            left: targetRect.left - 10,
            width: targetRect.width + 20,
            height: targetRect.height + 20,
          }}
          animate={{
            opacity: 1,
            top: targetRect.top - 10,
            left: targetRect.left - 10,
            width: targetRect.width + 20,
            height: targetRect.height + 20,
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{
            opacity: { duration: 0.16 },
            top: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
            left: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
            width: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
            height: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
          }}
          className="absolute z-[199] rounded-xl border-2 border-primary pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5),0_0_18px_rgba(var(--primary-rgb),0.35)]"
        />
      )}

      {!isTargetPending && (
        <motion.div
          initial={{ opacity: 0, y: targetRect ? 8 : 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="tutorial-modal-content bg-bg-surface border border-border-subtle rounded-[var(--radius-lg)] shadow-floating flex flex-col pointer-events-auto relative z-[200]"
          style={modalStyle}
        >
          {targetRect && arrowDir && (
            <div
              className="absolute w-4 h-4 bg-bg-surface rotate-45 pointer-events-none z-[201]"
              style={{
                ...(arrowDir === 'top' || arrowDir === 'bottom'
                  ? {
                      [arrowDir]: -8,
                      [arrowDir === 'top' ? 'borderTop' : 'borderBottom']:
                        '1px solid var(--color-border-subtle)',
                      [arrowDir === 'top' ? 'borderLeft' : 'borderRight']:
                        '1px solid var(--color-border-subtle)',
                      left: `clamp(16px, ${
                        targetRect.left - (modalStyle.left as number) + targetRect.width / 2 - 8
                      }px, calc(100% - 32px))`,
                    }
                  : {
                      [arrowDir]: -8,
                      [arrowDir === 'left' ? 'borderLeft' : 'borderRight']:
                        '1px solid var(--color-border-subtle)',
                      [arrowDir === 'left' ? 'borderBottom' : 'borderTop']:
                        '1px solid var(--color-border-subtle)',
                      top: `clamp(16px, ${
                        targetRect.top - (modalStyle.top as number) + targetRect.height / 2 - 8
                      }px, calc(100% - 32px))`,
                    }),
              }}
            />
          )}

          <AnimatePresence initial={false}>
            {!shouldHideHeader && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden shrink-0"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle/50">
                  <div className="text-lg font-semibold text-text-primary truncate">{title}</div>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="p-1.5 rounded-md hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer -mr-2 shrink-0"
                    aria-label="Close tutorial"
                  >
                    <X size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {shouldHideHeader && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => onOpenChange(false)}
                className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer z-10 bg-bg-surface/80 backdrop-blur-md shadow-sm border border-border-subtle"
                aria-label="Close tutorial"
              >
                <X size={16} />
              </motion.button>
            )}
          </AnimatePresence>

          <div
            className={`flex-1 px-5 py-5 text-text-secondary relative min-h-[140px] overflow-y-auto custom-scrollbar ${shouldHideHeader ? 'pt-6' : ''}`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="flex flex-col gap-4 w-full"
              >
                <div className={shouldHideHeader ? 'pr-8' : ''}>
                  <h3 className="text-base font-bold text-text-primary">{step.title}</h3>
                  <div className="text-sm text-text-secondary mt-1 leading-relaxed">
                    {step.description}
                  </div>
                  {step.hideImage && step.image && (
                    <Button
                      variant="bordered"
                      className="mt-3 h-8 text-sm px-3 flex items-center gap-2"
                      onClick={() => setEnlargedImage(step.image!)}
                    >
                      <ZoomIn size={14} /> View Reference Image
                    </Button>
                  )}
                </div>

                {!step.hideImage && step.image && (
                  <div
                    className="relative mt-2 rounded-lg overflow-hidden border border-border-subtle bg-bg-base/50 group cursor-pointer shadow-sm flex items-center justify-center flex-1 min-h-[140px] max-h-[260px]"
                    onClick={() => setEnlargedImage(step.image!)}
                  >
                    {!imageLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <Spinner size="md" color="primary" />
                      </div>
                    )}

                    <motion.img
                      layoutId={`tut-img-${currentStep}`}
                      src={step.image}
                      alt={step.title}
                      className={`w-full max-h-[260px] object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                      onLoad={() => setImageLoaded(true)}
                    />

                    {step.highlights?.map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="absolute border-[3px] border-primary bg-primary/20 rounded-md pointer-events-none shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                        style={{
                          top: `${h.top}%`,
                          left: `${h.left}%`,
                          width: `${h.width}%`,
                          height: `${h.height}%`,
                        }}
                      />
                    ))}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-lg">
                      <div className="bg-bg-surface/90 text-text-primary px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium backdrop-blur-md shadow-lg">
                        <ZoomIn size={16} /> Click to View
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 px-5 py-4 border-t border-border-subtle bg-bg-elevated/30 rounded-b-[var(--radius-lg)]">
            <div className="flex-1 flex items-center justify-start">
              <div className="flex gap-2">
                {!step.hideDots &&
                  steps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentStep ? 'w-6 bg-primary' : 'w-2 bg-border-strong'
                      }`}
                    />
                  ))}
              </div>
            </div>
            {step.secondaryButtonText !== null && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (step.onSecondaryClick) {
                    step.onSecondaryClick();
                  } else {
                    setCurrentStep((c) => Math.max(0, c - 1));
                  }
                }}
                disabled={!step.onSecondaryClick && currentStep === 0}
                className="mr-2 h-8 text-sm px-3"
              >
                {step.secondaryButtonText || 'Previous'}
              </Button>
            )}
            {step.skipButtonText && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (step.onSkipClick) {
                    step.onSkipClick();
                  } else {
                    onOpenChange(false);
                  }
                }}
                className="mr-2 h-8 text-sm px-3"
              >
                {step.skipButtonText}
              </Button>
            )}

            <Button
              variant="solid"
              color="primary"
              className="h-8 text-sm px-4"
              onClick={() => {
                if (step.onPrimaryClick) {
                  step.onPrimaryClick();
                } else if (currentStep === steps.length - 1) {
                  onOpenChange(false);
                } else {
                  setCurrentStep((c) => Math.min(steps.length - 1, c + 1));
                }
              }}
            >
              {step.primaryButtonText || (currentStep === steps.length - 1 ? 'Finish' : 'Next')}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );

  const zoomOverlay = enlargedImage && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setEnlargedImage(null)}
      className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-6 md:p-12 cursor-zoom-out pointer-events-auto"
    >
      <button
        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-10"
        onClick={(e) => {
          e.stopPropagation();
          setEnlargedImage(null);
        }}
      >
        <X size={24} />
      </button>
      <div className="relative w-full h-full flex items-center justify-center">
        <motion.img
          layoutId={`tut-img-${currentStep}`}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          src={enlargedImage}
          alt="Enlarged"
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-white/10"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </motion.div>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && step && (
        <motion.div
          key="tutorial-root-wrapper"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] pointer-events-none"
        >
          {modalOverlay}
          {zoomOverlay}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
