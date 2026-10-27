'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { forwardRef } from 'react';

import { cn } from './cn';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  label,
}: {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  label: string;
}) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue ?? items[0]?.value}
      value={value}
      onValueChange={onValueChange}
    >
      <TabsPrimitive.List
        aria-label={label}
        className="flex border-b border-line [scrollbar-width:none]"
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            className="relative flex min-h-12 flex-1 items-center justify-center px-2 text-sm font-bold uppercase tracking-[.04em] text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:inset-x-[18%] data-[state=active]:after:-bottom-px data-[state=active]:after:h-[3px] data-[state=active]:after:rounded-t-[3px] data-[state=active]:after:bg-accent"
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content
          key={item.value}
          value={item.value}
          className="pt-4 focus-visible:outline-none"
        >
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn('flex border-b border-line', className)} {...props} />
));
TabsList.displayName = 'TabsList';
