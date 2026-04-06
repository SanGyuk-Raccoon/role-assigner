import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Darakbox',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-slate-950 text-white min-h-screen font-sans antialiased">
        <header className="max-w-2xl mx-auto px-4 pt-6 pb-2">
          <a
            href="https://darakbox.com"
            className="text-xs font-bold text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-1 group"
          >
            <svg className="w-3 h-3 transform group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
            DARAKBOX
          </a>
        </header>
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 md:py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
