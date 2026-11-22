import type { ReactNode } from 'react';
import { Link, useRoute } from 'wouter';
import { PeekToggle } from './PeekToggle';

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const [active] = useRoute(href === '/' ? '/' : `${href}/*?`);
  return (
    <Link
      href={href}
      className={`rounded-pill px-3 py-1.5 text-sm transition-colors ${active ? 'bg-teal-50 text-teal-600' : 'text-ink-700 hover:text-ink-900'}`}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="A/B Test Kitchen home">
            <img src="/art/logo.svg" alt="" className="h-10 w-10" />
            <span className="display text-xl leading-none">
              A/B Test <em className="italic">Kitchen</em>
            </span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            <NavLink href="/">Menu</NavLink>
            <NavLink href="/tickets">Tickets</NavLink>
            <NavLink href="/pantry">Pantry</NavLink>
          </nav>
          <div className="ml-auto">
            <PeekToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-24 pt-8 sm:px-8">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-ink-500 sm:px-8">
          <span>Every test, every platform, one kitchen.</span>
          <span>Demo data: fictional clients and simulated traffic.</span>
        </div>
      </footer>
    </div>
  );
}
