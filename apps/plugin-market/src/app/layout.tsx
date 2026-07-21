import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Plugin Market — Open Factory',
  description: 'Discover and install plugins for Open Factory video editor',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        {/* Top nav */}
        <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface-0)]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
            <a href="/" className="flex items-center gap-2.5">
              {/* Logo mark */}
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-xs font-black text-white tracking-tight">
                OF
              </div>
              <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                Plugin Market
              </span>
            </a>

            <div className="flex items-center gap-1">
              <a
                href="/"
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Home
              </a>
              <a
                href="/"
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
              >
                Browse
              </a>
              <div className="ml-2 h-4 w-px bg-[var(--border)]" />
              <button className="ml-2 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] transition-colors">
                Sign In
              </button>
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>

        {/* Minimal footer */}
        <footer className="border-t border-[var(--border)] py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-xs text-[var(--text-tertiary)]">
                Open Factory Plugin Market
              </p>
              <div className="flex gap-4">
                <a
                  href="#"
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Terms
                </a>
                <a
                  href="#"
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Privacy
                </a>
                <a
                  href="#"
                  className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
