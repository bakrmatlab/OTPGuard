'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
const views = [
  'overview',
  'connections',
  'activity',
  'settings',
  'services',
] as const;
type View = (typeof views)[number];
const ViewContext = createContext<View>('overview');
/** Local navigation only. No provider, storage or cloud operations. */
export function Workspace({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('overview');
  useEffect(() => {
    const navigate = (focus: boolean) => {
      const hash = window.location.hash.slice(1);
      const next = views.find((value) => value === hash) ?? 'overview';
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
    <ViewContext.Provider value={view}>
      <div className="dashboard-shell" data-view={view}>
        {children}
      </div>
    </ViewContext.Provider>
  );
}

export function WorkspaceNavigation({
  sections,
}: {
  sections: readonly (readonly [string, string])[];
}) {
  const view = useContext(ViewContext);
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
