import Link from 'next/link';
import { Zap, Radio, Wallet, Bot, ArrowRight, Github, Shield } from 'lucide-react';
import ThemeToggle from '@/components/layout/ThemeToggle';

export default function LandingPage() {
  return (
    <main className="min-h-[100dvh] w-full flex flex-col">
      {/* NAV */}
      <nav className="flex items-center justify-between p-4 md:p-6">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-orange flex items-center justify-center border-2 border-black shadow-brut-sm">
            <Zap className="w-5 h-5 text-ink" strokeWidth={3} />
          </div>
          <span className="font-mono text-xl md:text-2xl font-bold">zappr</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          <Link
            href="/login"
            className="brut-btn text-xs md:text-sm !py-2 !px-3 md:!px-4 flex items-center gap-1.5"
          >
            Launch App
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="flex-1 flex items-center px-4 md:px-10 py-10 md:py-20">
        <div className="max-w-6xl mx-auto w-full">
          <div className="grid md:grid-cols-5 gap-8 md:gap-12 items-center">
            <div className="md:col-span-3 space-y-6">
              <div className="inline-flex items-center gap-2 border-2 border-black bg-volt text-ink px-3 py-1 font-mono text-[10px] md:text-xs uppercase tracking-widest shadow-brut-sm">
                <span className="w-1.5 h-1.5 bg-surface rounded-full animate-pulse" />
                Hack4Freedom Lagos 2026
              </div>
              <h1 className="font-mono text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight">
                Your <span className="bg-orange text-ink px-2 inline-block -rotate-1 border-2 border-black shadow-brut-sm">Bitcoin</span>
                <br />
                social hub,
                <br />
                with an{' '}
                <span className="bg-volt text-ink px-2 inline-block rotate-1 border-2 border-black shadow-brut-sm">
                  AI brain
                </span>
                .
              </h1>
              <p className="text-base md:text-lg text-bone/80 max-w-xl">
                zappr unifies your Nostr feed, your Lightning wallet, and a Claude-powered agent
                into one terminal. Log in with your nsec. Connect any NWC wallet. Zap, send, and
                chat your way through Bitcoin.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/login" className="brut-btn flex items-center gap-2">
                  Enter zappr <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="brut-btn-ghost flex items-center gap-2"
                >
                  <Github className="w-4 h-4" /> View Source
                </a>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-bone/50 pt-2">
                <Shield className="w-3.5 h-3.5" />
                Your keys never touch a server. 100% client-side.
              </div>
            </div>

            {/* Terminal mock */}
            <div className="md:col-span-2">
              <div className="brut-panel p-4 font-mono text-[11px] md:text-xs space-y-2">
                <div className="flex items-center gap-1.5 pb-2 border-b-2 border-black">
                  <div className="w-2.5 h-2.5 border-2 border-black bg-orange" />
                  <div className="w-2.5 h-2.5 border-2 border-black bg-volt" />
                  <div className="w-2.5 h-2.5 border-2 border-black bg-panel" />
                  <span className="ml-2 text-bone/50 uppercase tracking-widest text-[9px]">
                    zappr-agent
                  </span>
                </div>
                <div className="text-bone/80">&gt; check my balance</div>
                <div className="text-volt">⚡ reading wallet…</div>
                <div className="text-bone">
                  You have <span className="text-orange font-bold">42,069</span> sats available.
                </div>
                <div className="text-bone/80 pt-2">&gt; zap satoshi 210 sats</div>
                <div className="text-volt">⚡ preparing payment…</div>
                <div className="border-2 border-orange bg-orange/10 p-2 text-[10px]">
                  <div className="text-orange font-bold uppercase tracking-widest">
                    confirm zap
                  </div>
                  <div className="text-bone/80 mt-1">to: satoshi@nakamoto.com</div>
                  <div className="text-bone/80">amount: 210 sats</div>
                </div>
                <div className="flex gap-1.5">
                  <div className="flex-1 text-center border-2 border-black bg-orange text-ink py-1 text-[10px] font-bold">
                    APPROVE
                  </div>
                  <div className="flex-1 text-center border-2 border-black bg-panel py-1 text-[10px] font-bold">
                    CANCEL
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-4 md:px-10 py-10 md:py-16 border-t-2 border-black">
        <div className="max-w-6xl mx-auto">
          <div className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-bone/50 mb-2">
            // core features
          </div>
          <h2 className="font-mono text-2xl md:text-4xl font-bold mb-8 md:mb-12">
            One terminal. Three superpowers.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Radio,
                title: 'Unified Feed',
                body: 'Aggregates kind:1 notes across Damus, Nostr.band, nos.lol, Primal and Yakihonne. Zap any note with one tap.',
                color: 'bg-volt',
              },
              {
                icon: Wallet,
                title: 'Wallet via NWC',
                body: 'Not a custodial wallet. Connect Alby, Mutiny, Primal — anything that speaks Nostr Wallet Connect.',
                color: 'bg-orange',
              },
              {
                icon: Bot,
                title: 'Claude Agent',
                body: "Natural language over your feed and wallet. It reads, summarizes, and pays — with your approval on every send.",
                color: 'bg-black',
                iconColor: 'text-volt',
              },
            ].map((f) => (
              <div key={f.title} className="brut-panel p-5 space-y-3">
                <div
                  className={`w-12 h-12 ${f.color} border-2 border-black flex items-center justify-center shadow-brut-sm`}
                >
                  <f.icon className={`w-6 h-6 ${'iconColor' in f ? (f as { iconColor: string }).iconColor : 'text-ink'}`} strokeWidth={2.5} />
                </div>
                <h3 className="font-mono text-xl font-bold">{f.title}</h3>
                <p className="text-sm text-bone/80 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 md:px-10 py-12 md:py-20">
        <div className="max-w-4xl mx-auto brut-panel p-8 md:p-12 text-center">
          <h2 className="font-mono text-3xl md:text-5xl font-bold mb-4">Ready to zap?</h2>
          <p className="text-bone/80 mb-6 max-w-xl mx-auto">
            Grab your nsec, paste an NWC string, and you&apos;re in. No signup, no email, no
            server-side state.
          </p>
          <Link href="/login" className="brut-btn inline-flex items-center gap-2">
            Launch zappr <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-4 md:px-10 py-6 border-t-2 border-black">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 font-mono text-[11px] text-bone/50">
          <div>© 2026 zappr · Built for women in Bitcoin, Lagos</div>
          <div className="flex items-center gap-4">
            <span>nostr · lightning · ai</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
