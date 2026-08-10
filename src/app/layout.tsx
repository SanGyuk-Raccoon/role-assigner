import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: '역할 뽑기 | Darakbox',
  description: '서버 저장 없이 브라우저에서 역할과 마니또를 배정하고 결과 링크를 공유합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-950 font-sans text-white antialiased">
        <header className="max-w-2xl mx-auto px-4 pt-6 pb-2">
          <a
            href="https://darakbox.com"
            className="text-xs font-bold text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1 group"
          >
            <svg className="w-3 h-3 transform group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
            DARAKBOX
          </a>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
