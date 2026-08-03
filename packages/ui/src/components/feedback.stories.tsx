"use client";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { ToastProvider, useToast } from "./toast";

const meta = {
  title: "UI/Feedback",
};

export default meta;

function ToastDemo() {
  const { notify } = useToast();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() =>
        notify({
          description: "The notification stays dismissible and non-blocking.",
          title: "Settings saved",
        })
      }
    >
      Show notification
    </Button>
  );
}

export function Feedback() {
  return (
    <ToastProvider>
      <div className="grid w-[min(34rem,calc(100vw-2rem))] gap-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button">Open dialog</Button>
          </DialogTrigger>
          <DialogContent closeLabel="Close dialog">
            <DialogHeader>
              <DialogTitle>Confirm workspace change</DialogTitle>
              <DialogDescription>
                Dialog content keeps a clear title, description, close control,
                and responsive width for mobile screens.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline">
                Cancel
              </Button>
              <Button type="button">Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ToastDemo />
      </div>
    </ToastProvider>
  );
}
