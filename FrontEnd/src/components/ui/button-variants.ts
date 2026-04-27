import { cva } from "class-variance-authority";


export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-accent text-accent-ink shadow-sm hover:bg-accent/90 hover:-translate-y-px hover:shadow-accent-glow active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:-translate-y-px",
        outline:
          "border border-line bg-transparent text-ink hover:bg-surface-2 hover:text-ink hover:border-line-2",
        secondary:
          "bg-surface-2 text-ink shadow-sm hover:bg-surface-2/80",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)