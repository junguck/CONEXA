'use client';

import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { cn } from './cn';

type ToastTone = 'info' | 'success' | 'error';

interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (message: Omit<ToastMessage, 'id' | 'tone'> & { tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Fournit `notify()` et affiche une pile de messages (une région live unique). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);
  const notify = useCallback<ToastContextValue['notify']>(
    ({ title, description, tone = 'info' }) => {
      setMessages((current) => [
        ...current.slice(-2),
        {
          id: Date.now() + Math.random(),
          title,
          tone,
          ...(description === undefined ? {} : { description }),
        },
      ]);
    },
    [],
  );

  const value = useMemo(() => ({ notify }), [notify]);
  const dismiss = (id: number) =>
    setMessages((current) => current.filter((message) => message.id !== id));

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {messages.map((message) => (
          <ToastPrimitive.Root
            key={message.id}
            onOpenChange={(open) => {
              if (!open) dismiss(message.id);
            }}
            className={cn(
              'flex items-start justify-between gap-3 rounded-token border border-line bg-surface2 p-3.5 text-ink shadow-lg',
              message.tone === 'error' && 'border-bad',
              message.tone === 'success' && 'border-ok',
            )}
          >
            <div className="flex flex-col gap-1">
              <ToastPrimitive.Title className="text-sm font-bold">
                {message.title}
              </ToastPrimitive.Title>
              {message.description ? (
                <ToastPrimitive.Description className="text-sm text-muted">
                  {message.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close
              aria-label="Fermer la notification"
              className="flex h-8 w-8 items-center justify-center rounded-token text-muted hover:bg-surface"
            >
              <X className="h-4 w-4" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-full max-w-sm flex-col gap-2 px-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast doit être utilisé à l’intérieur de <ToastProvider>.');
  }
  return context;
}
