"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";

import { cn } from "../lib/utils";

export function Field({
  children,
  className,
  description,
  error,
  label,
  required,
}: {
  children: React.ReactNode;
  className?: string;
  description?: string;
  error?: string;
  label: string;
  required?: boolean;
}) {
  const id = React.useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [
    description ? descriptionId : undefined,
    error ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("grid gap-2", className)}>
      <LabelPrimitive.Root className="text-sm font-medium" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </LabelPrimitive.Root>
      {React.isValidElement(children)
        ? React.cloneElement(children, {
            "aria-describedby": describedBy || undefined,
            "aria-invalid": Boolean(error),
            id,
          } as React.HTMLAttributes<HTMLElement>)
        : children}
      {description ? (
        <p className="text-muted-foreground text-sm" id={descriptionId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p
          className="text-destructive text-sm font-medium"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
