export type ContactFormState =
  | {
      status: "idle";
    }
  | {
      fieldErrors?: Record<string, string>;
      message?: string;
      status: "error";
      values?: Record<string, string>;
    }
  | {
      message: string;
      resultToken: string;
      status: "success";
    };

export type ContactFormAction = (
  state: ContactFormState,
  formData: FormData,
) => Promise<ContactFormState>;
