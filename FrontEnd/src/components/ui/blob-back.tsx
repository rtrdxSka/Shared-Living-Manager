import * as React from "react"

import { cn } from "@/lib/utils"

export type BlobColor =
  | "accent"
  | "pos"
  | "neg"
  | "warn"
  | "cat-rent"
  | "cat-utilities"
  | "cat-groceries"
  | "cat-internet"
  | "cat-other"

export interface BlobBackProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: BlobColor
  size?: number
}

const COLOR_CLASS: Record<BlobColor, string> = {
  "accent":        "bg-accent",
  "pos":           "bg-pos",
  "neg":           "bg-neg",
  "warn":          "bg-warn",
  "cat-rent":      "bg-cat-rent",
  "cat-utilities": "bg-cat-utilities",
  "cat-groceries": "bg-cat-groceries",
  "cat-internet":  "bg-cat-internet",
  "cat-other":     "bg-cat-other",
}

const BlobBack = React.forwardRef<HTMLDivElement, BlobBackProps>(
  ({ color = "accent", size = 200, className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden
        className={cn(
          "pointer-events-none rounded-full opacity-40",
          COLOR_CLASS[color],
          className
        )}
        style={{
          width: size,
          height: size,
          filter: "blur(28px)",
          ...style,
        }}
        {...props}
      />
    )
  }
)
BlobBack.displayName = "BlobBack"

export { BlobBack }
