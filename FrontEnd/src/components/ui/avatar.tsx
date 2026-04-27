import * as React from "react"

import { cn } from "@/lib/utils"

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string
  size?: 24 | 28 | 36 | 64 | 72
  variant?: "filled" | "ghost"
}

function getInitials(name?: string): string {
  if (!name?.trim()) return "?"
  const trimmed = name.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

const SIZE_MAP: Record<number, { wh: string; text: string }> = {
  24: { wh: "w-6 h-6",    text: "text-[10px]" },
  28: { wh: "w-7 h-7",    text: "text-[11px]" },
  36: { wh: "w-9 h-9",    text: "text-[13px]" },
  64: { wh: "w-16 h-16",  text: "text-[22px]" },
  72: { wh: "w-[72px] h-[72px]", text: "text-[26px]" },
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ name, size = 28, variant = "filled", className, ...props }, ref) => {
    const { wh, text } = SIZE_MAP[size] ?? SIZE_MAP[28]
    const initials = getInitials(name)

    return (
      <div
        ref={ref}
        role={props.role ?? (name ? "img" : undefined)}
        aria-label={props["aria-label"] ?? (name ?? undefined)}
        className={cn(
          "rounded-full flex items-center justify-center font-medium select-none shrink-0",
          wh,
          text,
          variant === "filled"
            ? "bg-accent text-accent-ink"
            : "bg-transparent text-ink-3 border border-dashed border-line-2",
          className
        )}
        {...props}
      >
        {initials}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

export interface AvatarGroupProps {
  children: React.ReactNode
  max?: number
}

function AvatarGroup({ children, max = 3 }: AvatarGroupProps) {
  const items = React.Children.toArray(children).filter(React.isValidElement)
  const overflow = max > 0 && items.length > max ? items.length - max : 0
  const visible = max > 0 ? items.slice(0, max) : items

  return (
    <div className="flex items-center">
      {visible.map((child, i) => (
        <div
          key={i}
          className={cn(
            "ring-2 ring-background rounded-full",
            i > 0 ? "-ml-2" : ""
          )}
        >
          {child}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            "ring-2 ring-background rounded-full -ml-2",
            "w-7 h-7 flex items-center justify-center",
            "bg-surface-2 text-ink-3 text-[11px] font-medium select-none shrink-0"
          )}
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

export { Avatar, AvatarGroup }
