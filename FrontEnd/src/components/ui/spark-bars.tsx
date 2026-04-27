import { cn } from "@/lib/utils"

export interface SparkBarsProps {
  values: number[]
  highlightLast?: boolean
  height?: number
  barWidth?: number
  gap?: number
  className?: string
}

function SparkBars({
  values,
  highlightLast = true,
  height = 28,
  barWidth = 6,
  gap = 4,
  className,
}: SparkBarsProps) {
  const maxValue = Math.max(...values, 1)
  const lastIndex = values.length - 1

  return (
    <div
      className={cn("inline-flex items-end", className)}
      style={{ gap, height }}
      aria-hidden
    >
      {values.map((v, i) => {
        const barHeight = Math.max(2, (v / maxValue) * height)
        const isLast = highlightLast && i === lastIndex
        return (
          <div
            key={i}
            className={cn(
              "rounded-sm shrink-0",
              isLast ? "bg-accent" : "bg-line-2"
            )}
            style={{ width: barWidth, height: barHeight }}
          />
        )
      })}
    </div>
  )
}

export { SparkBars }
