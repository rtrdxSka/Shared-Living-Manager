import * as React from "react"

import { cn } from "@/lib/utils"
import { BlobBack } from "./blob-back"

export interface HeroNumberCardProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: React.ReactNode
  hero?: React.ReactNode
  subline?: React.ReactNode
  actions?: React.ReactNode
  rightSlot?: React.ReactNode
  blobs?: boolean
}

const HeroNumberCard = React.forwardRef<HTMLDivElement, HeroNumberCardProps>(
  (
    {
      eyebrow,
      hero,
      subline,
      actions,
      rightSlot,
      blobs = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-line bg-surface shadow-hero p-7 lg:p-8",
          className
        )}
        {...props}
      >
        {/* Subtle warm gradient overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent"
        />

        {/* Decorative blobs */}
        {blobs && (
          <>
            <BlobBack
              color="accent"
              size={200}
              className="absolute -top-10 -right-10"
            />
            <BlobBack
              color="cat-other"
              size={160}
              className="absolute -bottom-10 -left-10"
            />
          </>
        )}

        {/* Content */}
        <div
          className={cn(
            "relative z-10",
            rightSlot
              ? "flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between"
              : "flex flex-col gap-4"
          )}
        >
          {/* Left / main column */}
          <div className="flex flex-col gap-4 min-w-0">
            {eyebrow && <div>{eyebrow}</div>}
            {hero && <div>{hero}</div>}
            {subline && <div>{subline}</div>}
            {actions && <div>{actions}</div>}
            {children}
          </div>

          {/* Right slot */}
          {rightSlot && (
            <div className="shrink-0">{rightSlot}</div>
          )}
        </div>
      </div>
    )
  }
)
HeroNumberCard.displayName = "HeroNumberCard"

export { HeroNumberCard }
