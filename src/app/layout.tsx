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
        <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 md:py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
