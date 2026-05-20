import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-3 mb-4">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-3 mt-1 max-w-md">{description}</p>
      {action && (
        <div className="mt-6">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-line-2 hover:bg-surface-2 transition-colors"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}
