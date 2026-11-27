"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { s } from "@/lib/strings"
import { IconButton } from "@/components/ui/button"

/*
 * Dialog = a short focused task (sign in, manage account bindings).
 * Under 640px it rises from the bottom as a sheet; desktop stays centered.
 */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

const sizes = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[480px]",
  lg: "sm:max-w-[640px]",
}

const FIELD = 'input:not([type="hidden"]), textarea, select, [role="combobox"], [contenteditable="true"]'

function firstField(content: HTMLElement) {
  return [...content.querySelectorAll<HTMLElement>(FIELD)].find(
    (el) =>
      el.tabIndex >= 0 &&
      !(el as HTMLInputElement).disabled &&
      !el.closest('[aria-hidden="true"], [inert]') &&
      el.getClientRects().length > 0,
  )
}

export function DialogContent({
  size = "md",
  className,
  children,
  hideClose,
  onOpenAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  size?: keyof typeof sizes
  hideClose?: boolean
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="scrim"
        className="fixed inset-0 z-(--z-overlay) bg-scrim data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out"
      />
      <DialogPrimitive.Content
        onOpenAutoFocus={(e) => {
          onOpenAutoFocus?.(e)
          if (e.defaultPrevented) return
          const field = firstField(e.currentTarget as HTMLElement)
          if (!field) return
          e.preventDefault()
          field.focus()
        }}
        className={cn(
          "fixed z-(--z-overlay) flex max-h-[85dvh] flex-col bg-popover shadow-overlay outline-none",
          "sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
          "sm:data-[state=open]:animate-pop-in sm:data-[state=closed]:animate-pop-out",
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:rounded-t-2xl",
          "max-sm:data-[state=open]:animate-slide-in-up max-sm:data-[state=closed]:animate-slide-out-down",
          sizes[size],
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close asChild>
            <IconButton label={s().close} size="icon-sm" tooltip={false} className="absolute right-3 top-3 text-muted-foreground">
              <X />
            </IconButton>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({
  title,
  description,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("shrink-0 px-5 pb-3 pr-12 pt-5", className)}>
      <DialogPrimitive.Title className="truncate text-title font-semibold">{title}</DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="mt-1 text-body text-muted-foreground">{description}</DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
      )}
    </div>
  )
}

export function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-2 [scrollbar-gutter:stable]", className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-end gap-2 px-5 pb-5 pt-4",
        "max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))] max-sm:[&>button]:flex-1",
        className,
      )}
      {...props}
    />
  )
}
