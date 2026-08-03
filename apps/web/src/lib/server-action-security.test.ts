import { AuthError } from "@nextjs-saas/auth";
import { describe, expect, it } from "vitest";

import {
  parseJsonRequest,
  parsePasskeyAuthenticationOptionsRequest,
  parsePasskeyAuthenticationVerificationRequest,
  parsePasskeyRegistrationOptionsRequest,
  parsePasskeyRegistrationVerificationRequest,
  securityErrorResponse,
} from "./server-action-security";

const credentialBase = {
  clientExtensionResults: {},
  id: "credential_id",
  rawId: "credential_id",
  type: "public-key",
};

describe("server request validation", () => {
  it("validates passkey labels and registration credential fields", () => {
    expect(
      parsePasskeyRegistrationOptionsRequest({ label: " Laptop " }),
    ).toEqual({ label: "Laptop" });
    expect(() => parsePasskeyRegistrationOptionsRequest({ label: "" })).toThrow(
      "between 1 and 160",
    );
    expect(() =>
      parsePasskeyRegistrationVerificationRequest({ response: {} }),
    ).toThrow("Passkey id");
    expect(
      parsePasskeyRegistrationVerificationRequest({
        response: {
          ...credentialBase,
          response: {
            attestationObject: "attestation_object",
            clientDataJSON: "client_data",
          },
        },
      }).response.type,
    ).toBe("public-key");
  });

  it("validates authentication credentials and malformed JSON", async () => {
    expect(
      parsePasskeyAuthenticationOptionsRequest({
        email: " PASSKEY@Example.Test ",
      }),
    ).toEqual({ email: "passkey@example.test" });
    expect(parsePasskeyAuthenticationOptionsRequest({})).toEqual({
      email: undefined,
    });
    expect(() =>
      parsePasskeyAuthenticationOptionsRequest({ email: {} }),
    ).toThrow("Email must be a string");
    expect(() =>
      parsePasskeyAuthenticationVerificationRequest({
        response: {
          ...credentialBase,
          response: { clientDataJSON: "client_data" },
        },
      }),
    ).toThrow("authenticatorData");
    await expect(
      parseJsonRequest(
        new Request("https://app.example.test", {
          body: "{",
          method: "POST",
        }),
        parsePasskeyRegistrationOptionsRequest,
      ),
    ).rejects.toMatchObject({ code: "invalid_request", status: 400 });
    expect(
      securityErrorResponse(
        new AuthError("Invalid passkey.", "passkey_verification_failed"),
      )?.status,
    ).toBe(400);
  });
});
