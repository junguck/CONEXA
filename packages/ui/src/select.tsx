'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';

import { cn } from './cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label: string;
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  className?: string;
}

/** Liste déroulante accessible, libellée, cible tactile de 44 px minimum. */
export function Select({
  label,
  value,
  onValueChange,
  placeholder = 'Choisir…',
  options,
  disabled,
  className,
}: SelectProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">
        {label}
      </span>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          aria-label={label}
          className="flex min-h-12 items-center justify-between gap-2 rounded-token border-[1.5px] border-line bg-surface px-3.5 text-left text-[15px] text-ink focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent data-[placeholder]:text-muted disabled:opacity-50"
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown className="h-4 w-4" aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-token border border-line bg-surface p-1 text-ink shadow-lg"
          >
            <SelectPrimitive.Viewport>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'flex min-h-11 cursor-pointer select-none items-center justify-between gap-2 rounded-token px-3 text-[15px] outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-surface2 data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator>
      <Check className="h-4 w-4 text-accent-text" aria-hidden />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';
