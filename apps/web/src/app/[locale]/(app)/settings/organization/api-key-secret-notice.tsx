"use client";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@nextjs-saas/ui";
import { useActionState } from "react";

import {
  revealTenantApiKeySecretAction,
  type TenantApiKeySecretRevealState,
} from "../../tenant-actions";

const initialRevealState: TenantApiKeySecretRevealState = { status: "idle" };

export function ApiKeySecretNotice({
  description,
  enabled,
  loadingLabel,
  revealLabel,
  title,
  unavailableLabel,
}: {
  description: string;
  enabled: boolean;
  loadingLabel: string;
  revealLabel: string;
  title: string;
  unavailableLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    revealTenantApiKeySecretAction,
    initialRevealState,
  );

  if (!enabled) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardHeader>
      <CardContent aria-live="polite">
        {state.status === "ready" ? (
          <code className="bg-muted block overflow-x-auto rounded-md p-3 text-sm">
            {state.secret}
          </code>
        ) : null}
        {state.status === "idle" ? (
          <form action={formAction}>
            <Button disabled={isPending} type="submit">
              {isPending ? loadingLabel : revealLabel}
            </Button>
          </form>
        ) : null}
        {state.status === "unavailable" ? (
          <p className="text-muted-foreground text-sm">{unavailableLabel}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
