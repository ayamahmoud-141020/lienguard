// Our button API on top of the template's shadcn/ui Button (MIT).
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { Button as UiButton } from "@/components/ui/button";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";
const variant = { primary: "default", secondary: "outline", ghost: "ghost" } as const;
const size = { sm: "sm", md: "default" } as const;

export function Button({ variant: v = "secondary", size: s = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <UiButton variant={variant[v]} size={size[s]} {...props} />;
}

export function ButtonLink({ variant: v = "secondary", size: s = "md", children, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <UiButton asChild variant={variant[v]} size={size[s]}>
      <Link {...props}>{children}</Link>
    </UiButton>
  );
}
