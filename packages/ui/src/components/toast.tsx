"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";

type ToastMessage = {
  id: string;
  title: string;
  description?: string;
};

type ToastContextValue = {
  notify: (message: Omit<ToastMessage, "id">) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined,
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<ToastMessage[]>([]);

  const notify = React.useCallback((message: Omit<ToastMessage, "id">) => {
    setMessages((current) => [
      ...current,
      { ...message, id: crypto.randomUUID() },
    ]);
  }, []);

  const value = React.useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {messages.map((message) => (
          <ToastPrimitive.Root
            className="bg-popover text-popover-foreground relative grid w-full gap-1 rounded-lg border p-4 pe-10 shadow-lg"
            duration={4000}
            key={message.id}
            onOpenChange={(open) => {
              if (!open) {
                setMessages((current) =>
                  current.filter((item) => item.id !== message.id),
                );
              }
            }}
          >
            <ToastPrimitive.Title className="text-sm font-semibold">
              {message.title}
            </ToastPrimitive.Title>
            {message.description ? (
              <ToastPrimitive.Description className="text-muted-foreground text-sm">
                {message.description}
              </ToastPrimitive.Description>
            ) : null}
            <ToastPrimitive.Close className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring absolute end-2 top-2 inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none">
              <XIcon aria-hidden="true" className="size-4" />
              <span className="sr-only">Dismiss notification</span>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport
          className={cn(
            "fixed end-0 bottom-0 z-50 flex max-h-screen w-full flex-col gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-sm",
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.use(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
