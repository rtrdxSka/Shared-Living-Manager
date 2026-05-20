import * as React from "react"

import { cn } from "@/lib/utils"
import { EXPENSE_TYPE_LABELS, type ExpenseType } from "@/types/onboarding.types"

export type Category = ExpenseType

export interface CategoryChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  category: Category
}

const CATEGORY_BG: Record<Category, string> = {
  rent:          "bg-cat-rent",
  utilities:     "bg-cat-utilities",
  groceries:     "bg-cat-groceries",
  internet:      "bg-cat-internet",
  cleaning:      "bg-cat-cleaning",
  subscriptions: "bg-cat-subscriptions",
  other:         "bg-cat-other",
}

const CategoryChip = React.forwardRef<HTMLSpanElement, CategoryChipProps>(
  ({ category, className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-accent-ink",
          CATEGORY_BG[category] ?? CATEGORY_BG.other,
          className
        )}
        {...props}
      >
        {children ?? EXPENSE_TYPE_LABELS[category]}
      </span>
    )
  }
)
CategoryChip.displayName = "CategoryChip"

export { CategoryChip }
