import { CalendarClock } from 'lucide-react';

export default function Productivity() {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">Focus</p>
        <h2 className="mt-2 text-3xl font-semibold">Productivity</h2>
      </header>

      <div className="rounded-3xl border border-zinc-800 bg-obsidian-card p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-950 text-obsidian-accent">
          <CalendarClock size={28} />
        </div>
        <h3 className="mt-6 text-xl font-medium">Calendar integration staging area</h3>
        <p className="mt-2 max-w-2xl text-zinc-400">
          This tab is ready for a future Google Calendar sync, activity classification, and deep-work trend views.
        </p>
      </div>
    </section>
  );
}
