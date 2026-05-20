import * as React from "react"

import { cn } from "@/lib/utils"

/** Pixels added to the active segment's strokeWidth in controlled mode. */
const ACTIVE_STROKE_BOOST = 3

export interface DonutSegment {
  /** Required when `activeId` is used; ignored otherwise. */
  id?: string
  value: number
  color: string
}

export interface DonutProps {
  size?: number
  thickness?: number
  segments: DonutSegment[]
  centerLabel?: React.ReactNode
  centerSubLabel?: React.ReactNode
  className?: string
  /** When provided (even as null), enables controlled cross-link mode. */
  activeId?: string | null
  onActiveChange?: (id: string | null) => void
}

interface ArcEntry {
  seg: DonutSegment
  dashLength: number
  dashOffset: number
}

function buildArcs(
  segments: DonutSegment[],
  circumference: number
): ArcEntry[] {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1
  const result: ArcEntry[] = []
  segments.reduce((consumed, seg) => {
    const fraction = seg.value / total
    const dashLength = fraction * circumference
    const dashOffset = circumference - consumed * circumference
    result.push({ seg, dashLength, dashOffset })
    return consumed + fraction
  }, 0)
  return result
}

function Donut({
  size = 130,
  thickness = 16,
  segments,
  centerLabel,
  centerSubLabel,
  className,
  activeId,
  onActiveChange,
}: DonutProps) {
  const center = size / 2
  const radius = center - thickness / 2
  const circumference = 2 * Math.PI * radius
  const arcs = buildArcs(segments, circumference)
  const isControlled = activeId !== undefined

  return (
    <div
      className={cn("relative inline-block", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden
      >
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--line))"
          strokeWidth={thickness}
        />

        {/* Segments */}
        {arcs.map(({ seg, dashLength, dashOffset }, i) => {
          const isActive = isControlled && seg.id != null && seg.id === activeId
          const isDimmed = isControlled && activeId != null && !isActive

          return (
            <circle
              key={isControlled ? (seg.id ?? i) : i}
              data-segment-id={isControlled ? seg.id : undefined}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={isActive ? thickness + ACTIVE_STROKE_BOOST : thickness}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              style={
                isControlled
                  ? {
                      opacity: isDimmed ? 0.3 : 1,
                      transition: "opacity 150ms, stroke-width 150ms",
                      cursor: onActiveChange ? "pointer" : undefined,
                      pointerEvents: "visibleStroke",
                    }
                  : undefined
              }
              onMouseEnter={
                isControlled && onActiveChange && seg.id != null
                  ? () => onActiveChange(seg.id ?? null)
                  : undefined
              }
              onMouseLeave={
                isControlled && onActiveChange
                  ? () => onActiveChange(null)
                  : undefined
              }
            />
          )
        })}
      </svg>

      {/* Center labels — HTML overlay */}
      {(centerLabel || centerSubLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {centerLabel && (
            <div className="text-ink font-semibold num leading-none">
              {centerLabel}
            </div>
          )}
          {centerSubLabel && (
            <div className="text-ink-3 mt-0.5" style={{ fontSize: 10 }}>
              {centerSubLabel}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export { Donut }
