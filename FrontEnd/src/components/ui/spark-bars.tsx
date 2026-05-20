import * as React from "react"
import { cn } from "@/lib/utils"

/** Vertical scale applied to the active bar (origin: bottom). */
const ACTIVE_BAR_SCALE = 1.15

export interface SparkBarsProps {
  values: number[]
  highlightLast?: boolean
  height?: number
  barWidth?: number
  gap?: number
  className?: string
  /** When provided (even as null), enables controlled cross-link mode. */
  activeIndex?: number | null
  onActiveChange?: (i: number | null) => void
  /** Renders above the active bar when activeIndex is set. */
  valueLabel?: (index: number, value: number) => React.ReactNode
}

function SparkBars({
  values,
  highlightLast = true,
  height = 28,
  barWidth = 6,
  gap = 4,
  className,
  activeIndex,
  onActiveChange,
  valueLabel,
}: SparkBarsProps) {
  const maxValue = Math.max(...values, 1)
  const lastIndex = values.length - 1
  const isControlled = activeIndex !== undefined

  return (
    <div
      className={cn("inline-flex items-end", className)}
      style={{
        gap,
        height,
        position: isControlled ? "relative" : undefined,
      }}
      aria-hidden
      onMouseLeave={
        isControlled && onActiveChange ? () => onActiveChange(null) : undefined
      }
    >
      {values.map((v, i) => {
        const barHeight = Math.max(2, (v / maxValue) * height)
        const isLast = highlightLast && i === lastIndex
        const isActive = isControlled && activeIndex === i

        return (
          <div
            key={i}
            data-bar-index={isControlled ? i : undefined}
            className={cn(
              "rounded-sm shrink-0",
              isLast ? "bg-accent" : "bg-line-2",
              isControlled && onActiveChange && "cursor-pointer"
            )}
            style={{
              width: barWidth,
              height: barHeight,
              transform: isActive ? `scaleY(${ACTIVE_BAR_SCALE})` : "",
              transformOrigin: isControlled ? "bottom" : undefined,
              transition: isControlled ? "transform 150ms" : undefined,
            }}
            onMouseEnter={
              isControlled && onActiveChange ? () => onActiveChange(i) : undefined
            }
          />
        )
      })}

      {/* Value label overlay — anchored above the active bar. */}
      {isControlled && activeIndex != null && valueLabel && (
        <div
          style={{
            position: "absolute",
            left: activeIndex * (barWidth + gap) + barWidth / 2,
            top: -2,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
          }}
        >
          {valueLabel(activeIndex, values[activeIndex])}
        </div>
      )}
    </div>
  )
}

export { SparkBars }
