import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

const button = cva('inline-flex items-center justify-center rounded-md transition', {
  variants: {
    variant: {
      primary: 'bg-accent text-surface hover:opacity-90',
      secondary: 'border border-accent text-accent',
      ghost: 'text-text hover:bg-white/5',
      danger: 'bg-red-600 text-white',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
})

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading = false, disabled, children, ...props }, ref) => {
    const isDisabled = disabled ?? isLoading

    return (
      <button
        ref={ref}
        className={twMerge(
          clsx(button({ variant, size }), 'disabled:cursor-not-allowed disabled:opacity-50', className),
        )}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <span aria-hidden="true" className="mr-2 inline-block animate-spin">
            ⏳
          </span>
        ) : null}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
