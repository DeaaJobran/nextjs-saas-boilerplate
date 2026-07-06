import { SettingsIcon } from "lucide-react";

import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
};

export default meta;

export function Variants() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button aria-label="Open settings" size="icon" variant="outline">
        <SettingsIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
