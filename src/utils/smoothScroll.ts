const WHEEL_MULTIPLIER = 1.05;

type ScrollState = {
  targetTop: number;
  targetLeft: number;
  raf: number;
};

const states = new WeakMap<HTMLElement, ScrollState>();

function isScrollable(element: HTMLElement, axis: 'x' | 'y') {
  const style = window.getComputedStyle(element);
  const overflow = axis === 'y' ? style.overflowY : style.overflowX;
  const canScroll =
    axis === 'y'
      ? element.scrollHeight > element.clientHeight + 1
      : element.scrollWidth > element.clientWidth + 1;
  return canScroll && /(auto|scroll|overlay)/.test(overflow);
}

function findScrollTarget(start: EventTarget | null, deltaX: number, deltaY: number) {
  let element = start instanceof Element ? start : null;
  while (element && element !== document.body) {
    if (element instanceof HTMLElement) {
      const needsY = Math.abs(deltaY) >= Math.abs(deltaX);
      if ((needsY && isScrollable(element, 'y')) || (!needsY && isScrollable(element, 'x'))) {
        return element;
      }
    }
    element = element.parentElement;
  }
  return document.scrollingElement as HTMLElement | null;
}

function animateScroll(element: HTMLElement, state: ScrollState) {
  const diffTop = state.targetTop - element.scrollTop;
  const diffLeft = state.targetLeft - element.scrollLeft;

  if (Math.abs(diffTop) < 0.5 && Math.abs(diffLeft) < 0.5) {
    element.scrollTop = state.targetTop;
    element.scrollLeft = state.targetLeft;
    states.delete(element);
    return;
  }

  element.scrollTop += diffTop * 0.15;
  element.scrollLeft += diffLeft * 0.15;

  state.raf = window.requestAnimationFrame(() => animateScroll(element, state));
}

export function installSmoothScroll() {
  if ((window as any).__ismSmoothScrollInstalled) return;
  (window as any).__ismSmoothScrollInstalled = true;

  window.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || event.metaKey) return;
      const targetElement = event.target instanceof HTMLElement ? event.target : null;
      if (targetElement?.closest('input[type="range"], select, textarea')) return;

      const scrollTarget = findScrollTarget(event.target, event.deltaX, event.deltaY);
      if (!scrollTarget) return;

      const maxTop = scrollTarget.scrollHeight - scrollTarget.clientHeight;
      const maxLeft = scrollTarget.scrollWidth - scrollTarget.clientWidth;
      if (maxTop <= 0 && maxLeft <= 0) return;

      event.preventDefault();

      const existing = states.get(scrollTarget);
      if (existing) {
        window.cancelAnimationFrame(existing.raf);
      }

      const baseTop = existing?.targetTop ?? scrollTarget.scrollTop;
      const baseLeft = existing?.targetLeft ?? scrollTarget.scrollLeft;
      const targetTop = Math.max(0, Math.min(maxTop, baseTop + event.deltaY * WHEEL_MULTIPLIER));
      const targetLeft = Math.max(0, Math.min(maxLeft, baseLeft + event.deltaX * WHEEL_MULTIPLIER));

      const state: ScrollState = {
        targetTop,
        targetLeft,
        raf: 0,
      };

      states.set(scrollTarget, state);
      state.raf = window.requestAnimationFrame(() => animateScroll(scrollTarget, state));
    },
    { passive: false },
  );
}
