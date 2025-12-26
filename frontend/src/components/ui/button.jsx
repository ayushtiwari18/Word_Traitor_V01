import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold font-heading ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_hsl(180_100%_50%/0.4)]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-transparent text-foreground hover:border-primary hover:text-primary hover:shadow-[0_0_15px_hsl(180_100%_50%/0.3)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-[0_0_20px_hsl(271_76%_53%/0.4)]",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        neonCyan: "bg-primary text-primary-foreground font-bold tracking-wide hover:shadow-[0_0_25px_hsl(180_100%_50%/0.6),0_0_50px_hsl(180_100%_50%/0.3)] hover:-translate-y-0.5 active:translate-y-0",
        neonPurple: "bg-secondary text-secondary-foreground font-bold tracking-wide hover:shadow-[0_0_25px_hsl(271_76%_53%/0.6),0_0_50px_hsl(271_76%_53%/0.3)] hover:-translate-y-0.5 active:translate-y-0",
        glassOutline: "border-2 border-primary/50 bg-primary/10 text-primary backdrop-blur-sm hover:bg-primary/20 hover:border-primary hover:shadow-[0_0_20px_hsl(180_100%_50%/0.4)]",
        glassPurple: "border-2 border-secondary/50 bg-secondary/10 text-secondary backdrop-blur-sm hover:bg-secondary/20 hover:border-secondary hover:shadow-[0_0_20px_hsl(271_76%_53%/0.4)]",
        vote: "border-2 border-destructive/50 bg-destructive/10 text-destructive backdrop-blur-sm hover:bg-destructive/20 hover:border-destructive hover:shadow-[0_0_20px_hsl(0_72%_51%/0.4)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };