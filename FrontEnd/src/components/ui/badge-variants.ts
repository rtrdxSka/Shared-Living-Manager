import { cva } from 'class-variance-authority';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-accent text-accent-ink',
        secondary:
          'border-transparent bg-surface-2 text-ink-2',
        destructive:
          'border-transparent bg-neg text-accent-ink',
        outline: 'border-line text-ink-2',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);
