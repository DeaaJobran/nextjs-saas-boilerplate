import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  TextInput,
} from "@nextjs-saas/ui";

async function handleSaveProfile() {
  "use server";
  // TODO: Persist profile updates once the identity and database modules exist.
}

export default function SettingsPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile settings</CardTitle>
          <p className="text-muted-foreground text-sm">
            Form primitives reserve the contract for the identity module.
          </p>
        </CardHeader>
        <CardContent>
          <form action={handleSaveProfile} className="grid gap-4">
            <Field label="Display name">
              <TextInput defaultValue="Demo User" name="name" />
            </Field>
            <Field label="Email">
              <TextInput
                defaultValue="demo@example.com"
                name="email"
                type="email"
              />
            </Field>
            <Button type="submit">Save profile</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Application settings</CardTitle>
          <p className="text-muted-foreground text-sm">
            Settings pages use the same responsive shell as product modules.
          </p>
        </CardHeader>
        <CardContent className="text-muted-foreground grid gap-3 text-sm">
          <p>
            Theme, locale, notifications, and organization settings will reuse
            this layout.
          </p>
          <p>
            Security-sensitive controls are separated before destructive actions
            are added.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
