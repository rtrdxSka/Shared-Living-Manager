import * as React from "react"

import { cn } from "@/lib/utils"

export interface MoneyAmountProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number
  currency?: string
  signed?: boolean
  tone?: "auto" | "pos" | "neg" | "neutral"
  size?: "sm" | "md" | "lg" | "hero"
  decimals?: number
}

const SIZE_CLASSES: Record<NonNullable<MoneyAmountProps["size"]>, string> = {
  sm:   "text-sm",
  md:   "text-base",
  lg:   "text-2xl font-semibold",
  hero: "text-[64px] leading-none font-semibold tracking-[-0.03em]",
}

const TONE_CLASSES: Record<NonNullable<MoneyAmountProps["tone"]>, string> = {
  pos:     "text-pos",
  neg:     "text-neg",
  auto:    "",
  neutral: "",
}

const MoneyAmount = React.forwardRef<HTMLSpanElement, MoneyAmountProps>(
  (
    {
      amount,
      currency = "",
      signed = false,
      tone = "neutral",
      size = "md",
      decimals = 2,
      className,
      ...props
    },
    ref
  ) => {
    // Resolve tone class
    let toneClass = TONE_CLASSES[tone]
    if (tone === "auto") {
      toneClass = amount >= 0 ? "text-pos" : "text-neg"
    }

    // Build formatted string
    const absFormatted = Math.abs(amount).toFixed(decimals)
    let prefix = ""
    if (signed && amount > 0) prefix = "+"
    else if (signed && amount < 0) prefix = "−" // Unicode minus U+2212

    const displayText = `${prefix}${absFormatted}${currency ? " " + currency : ""}`

    return (
      <span
        ref={ref}
        className={cn("num", SIZE_CLASSES[size], toneClass, className)}
        {...props}
      >
        {displayText}
      </span>
    )
  }
)
MoneyAmount.displayName = "MoneyAmount"

export { MoneyAmount }
