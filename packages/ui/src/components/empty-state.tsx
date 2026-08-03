import { SearchIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import type { StateProps } from "./state-types";

type EmptyStateProps = StateProps & {
  headingLevel?: "h2" | "h3" | "h4";
};

export function EmptyState({
  action,
  className,
  description,
  headingLevel: Heading = "h2",
  title,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 p-6 text-center">
        <SearchIcon
          aria-hidden="true"
          className="text-muted-foreground size-8"
        />
        <div className="max-w-md space-y-2">
          <Heading className="text-lg font-semibold">{title}</Heading>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {action ? (
          action.href ? (
            <Button asChild variant="outline">
              <a href={action.href}>{action.label}</a>
            </Button>
          ) : (
            <Button onClick={action.onClick} type="button" variant="outline">
              {action.label}
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
