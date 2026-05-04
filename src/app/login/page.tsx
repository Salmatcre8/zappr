import Link from 'next/link';
import LoginPanel from '@/components/auth/LoginPanel';
import ThemeToggle from '@/components/layout/ThemeToggle';
import { Zap, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  return (
    <main className="min-h-[100dvh] w-full flex flex-col">
      <nav className="flex items-center justify-between p-4 md:p-6">
        <Link href="/" className="flex items-center gap-2 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
          <span className="font-mono text-xs uppercase tracking-widest">Back</span>
        </Link>
        <ThemeToggle />
      </nav>
      <div className="flex-1 flex items-center justify-center p-4 md:p-10">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex items-center gap-3">
            <div className="w-12 h-12 bg-orange flex items-center justify-center brut">
              <Zap className="w-6 h-6 text-ink" strokeWidth={3} />
            </div>
            <div>
              <h1 className="font-mono text-4xl font-bold tracking-tight">zappr</h1>
              <p className="font-mono text-xs text-bone/60 uppercase tracking-widest">
                Bitcoin · Nostr · AI
              </p>
            </div>
          </div>
          <LoginPanel />
        </div>
      </div>
    </main>
  );
}
