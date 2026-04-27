import type { ReactNode } from 'react';

export interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}

export default function DashboardHeader({ title, subtitle, rightSlot }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-lg supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: title + subtitle */}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink font-sans leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-ink-3 leading-tight mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        {/* Right: optional slot */}
        {rightSlot != null && (
          <div className="flex shrink-0 items-center gap-3">{rightSlot}</div>
        )}
      </div>
    </header>
  );
}
