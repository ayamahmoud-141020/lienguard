"use client";

// Thin wrappers over the template's shadcn/ui tooltip and popover, so app code keeps one simple API.
import type { ReactNode } from "react";
import { Tooltip as T, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent as PC, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "./cn";

export { Popover, PopoverTrigger };

export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-72 text-xs">
        {content}
      </TooltipContent>
    </T>
  );
}

export function PopoverContent({ children, className, align = "end" }: { children: ReactNode; className?: string; align?: "start" | "center" | "end" }) {
  return (
    <PC align={align} sideOffset={8} className={cn("w-80", className)}>
      {children}
    </PC>
  );
}
