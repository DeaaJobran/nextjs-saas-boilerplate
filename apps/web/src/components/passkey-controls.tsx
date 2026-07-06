"use client";

import { Button, Field, TextInput } from "@nextjs-saas/ui";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { useState } from "react";

type PasskeyRegistrationLabels = {
  error: string;
  label: string;
  register: string;
  success: string;
};

type PasskeyAuthenticationLabels = {
  email: string;
  error: string;
  signIn: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export function PasskeyRegistrationControl({
  labels,
}: {
  labels: PasskeyRegistrationLabels;
}) {
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState<"error" | "idle" | "success">("idle");

  async function registerPasskey() {
    setStatus("idle");

    try {
      const options = await postJson<Parameters<typeof startRegistration>[0]>(
        "/api/auth/passkeys/register/options",
        { label },
      );
      const response = await startRegistration({
        optionsJSON: options as never,
      });

      await postJson("/api/auth/passkeys/register/verify", {
        label,
        response,
      });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="grid gap-3">
      <Field label={labels.label}>
        <TextInput
          autoComplete="off"
          name="passkeyLabel"
          onChange={(event) => setLabel(event.target.value)}
          value={label}
        />
      </Field>
      <Button onClick={registerPasskey} type="button" variant="outline">
        {labels.register}
      </Button>
      {status === "success" ? (
        <p className="text-muted-foreground text-sm" role="status">
          {labels.success}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="text-destructive text-sm" role="alert">
          {labels.error}
        </p>
      ) : null}
    </div>
  );
}

export function PasskeyAuthenticationControl({
  labels,
  redirectTo,
}: {
  labels: PasskeyAuthenticationLabels;
  redirectTo: string;
}) {
  const [email, setEmail] = useState("");
  const [failed, setFailed] = useState(false);

  async function signInWithPasskey() {
    setFailed(false);

    try {
      const options = await postJson<Parameters<typeof startAuthentication>[0]>(
        "/api/auth/passkeys/authenticate/options",
        { email: email || undefined },
      );
      const response = await startAuthentication({
        optionsJSON: options as never,
      });

      await postJson("/api/auth/passkeys/authenticate/verify", { response });
      window.location.assign(redirectTo);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="grid gap-3">
      <Field label={labels.email}>
        <TextInput
          autoComplete="email"
          name="passkeyEmail"
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          value={email}
        />
      </Field>
      <Button onClick={signInWithPasskey} type="button" variant="outline">
        {labels.signIn}
      </Button>
      {failed ? (
        <p className="text-destructive text-sm" role="alert">
          {labels.error}
        </p>
      ) : null}
    </div>
  );
}
