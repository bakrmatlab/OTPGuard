'use client';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
const views = ['connections', 'activity', 'settings'] as const;
type View = (typeof views)[number];
const ViewContext = createContext<View>('connections');
/** Local navigation only. No provider, storage or cloud operations. */
export function Workspace({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('connections');
  useEffect(() => {
    const navigate = (focus: boolean) => {
      const hash = window.location.hash.slice(1);
      const next = views.find((value) => value === hash) ?? 'connections';
      // The hash exists only in the browser, so the first view is set after hydration.
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      setView(next);
      if (focus)
        requestAnimationFrame(() => {
          const panel = document.getElementById(next);
          panel?.focus({ preventScroll: true });
          window.scrollTo({ top: 0 });
        });
    };
    const changed = () => navigate(true);
    navigate(false);
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  return (
    <ViewContext value={view}>
      <div className="workspace" data-view={view}>
        {children}
      </div>
    </ViewContext>
  );
}

export function WorkspaceNavigation({
  sections,
}: {
  sections: readonly (readonly [string, string])[];
}) {
  const view = use(ViewContext);
  return (
    <nav aria-label="Dashboard">
      {sections.map(([id, label]) => (
        <a
          key={id}
          href={`#${id}`}
          aria-current={view === id ? 'page' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
