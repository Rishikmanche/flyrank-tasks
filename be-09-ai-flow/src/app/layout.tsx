import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Decision Flow — React Flow + Inngest',
  description: 'Visual AI workflow system with YES/NO decision branching',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">{children}</body>
    </html>
  );
}
