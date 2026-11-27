/**
 * Theme switching shared by the Super Admin and company portals.
 *
 * The new theme is revealed as a circle growing from `origin` (View Transitions API). The default
 * cross-fade is turned off in globals.css (`::view-transition-*(root)`).
 *
 * While the switch runs, `html.theme-switching` turns CSS transitions off. Without it, anything
 * with `transition-colors` (linked cards, buttons, rows) animates its colours on its own timeline
 * and visibly lags behind the rest of the page.
 */

export type ThemeOrigin = { x: number; y: number };

const SWITCHING_CLASS = "theme-switching";

/** Centre of an element in viewport coordinates, e.g. the clicked toggle button. */
export function centerOf(el: Element): ThemeOrigin {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Runs `apply` (which must update the DOM synchronously, e.g. via flushSync) inside a circular
 * reveal. Instant switch when the API is unsupported or the user prefers reduced motion.
 */
export function switchThemeAnimated(apply: () => void, origin?: ThemeOrigin) {
  // Typed locally: the project's DOM lib predates the View Transitions API.
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.add(SWITCHING_CLASS);
  const done = () => root.classList.remove(SWITCHING_CLASS);

  if (!doc.startViewTransition || reduceMotion) {
    apply();
    // Paint the new colours once with transitions off, then restore them.
    requestAnimationFrame(() => requestAnimationFrame(done));
    return;
  }

  const x = origin?.x ?? window.innerWidth - 40;
  const y = origin?.y ?? 32;
  // Radius that reaches the farthest viewport corner from the origin.
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const transition = doc.startViewTransition(apply);
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 550, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {
      /* transition skipped; theme is already applied */
    });
  transition.finished.then(done, done);
}
