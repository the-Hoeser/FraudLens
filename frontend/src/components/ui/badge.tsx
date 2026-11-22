import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground shadow",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground shadow",
        outline: "text-foreground",
        demo: "border-warning/50 bg-warning/10 text-warning font-mono uppercase tracking-wider text-[0.65rem]",
        live: "border-primary/50 bg-primary/10 text-primary font-mono uppercase tracking-wider text-[0.65rem]",
        fraud: "border-fraud/40 bg-fraud/10 text-fraud",
        legit: "border-legit/40 bg-legit/10 text-legit",
        "risk-low": "border-risk-low/40 bg-risk-low/10 text-risk-low",
        "risk-medium": "border-risk-medium/40 bg-risk-medium/10 text-risk-medium",
        "risk-high": "border-risk-high/40 bg-risk-high/10 text-risk-high",
        "risk-critical": "border-risk-critical/50 bg-risk-critical/15 text-risk-critical",
        muted: "border-border bg-muted text-muted-foreground",
        success: "border-signal/40 bg-signal/10 text-signal",
        warning: "border-warning/40 bg-warning/10 text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };