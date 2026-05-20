import * as React from "react"

import { cn } from "@/lib/utils"

export interface EyebrowLabelProps extends React.HTMLAttributes<HTMLElement> {
  as?: "span" | "div" | "p"
}

const EyebrowLabel = React.forwardRef<HTMLElement, EyebrowLabelProps>(
  ({ as: Tag = "span", className, ...props }, ref) => {
    return (
      <Tag
        ref={ref as React.Ref<HTMLSpanElement & HTMLDivElement & HTMLParagraphElement>}
        className={cn("eyebrow", className)}
        {...props}
      />
    )
  }
)
EyebrowLabel.displayName = "EyebrowLabel"

export { EyebrowLabel }
