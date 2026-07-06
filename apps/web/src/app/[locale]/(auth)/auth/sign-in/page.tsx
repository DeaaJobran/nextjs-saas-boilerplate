import { appConfig } from "@nextjs-saas/config/app";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  TextInput,
} from "@nextjs-saas/ui";

export default function SignInPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to {appConfig.shortName}</CardTitle>
        <p className="text-muted-foreground text-sm">
          The identity module will attach providers to this stable auth layout.
        </p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4">
          <Field label="Email" required>
            <TextInput
              autoComplete="email"
              name="email"
              required
              type="email"
            />
          </Field>
          <Field label="Password" required>
            <TextInput
              autoComplete="current-password"
              name="password"
              required
              type="password"
            />
          </Field>
          <Button type="submit">Sign in</Button>
        </form>
      </CardContent>
    </Card>
  );
}
