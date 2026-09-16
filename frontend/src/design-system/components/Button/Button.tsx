import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import clsx from 'clsx'
import { twMerge } from 'tailwind-merge'

const button = cva('inline-flex items-center justify-center rounded-md transition', {
  variants: {
    variant: {
      primary: 'bg-accent text-surface hover:bg-accent-hover',
      secondary: 'border border-accent text-accent hover:bg-accent/10',
      ghost: 'text-text hover:bg-white/5',
      danger: 'bg-danger text-text hover:bg-danger-hover',
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

/**
 * `currentColor` faz o spinner herdar a cor do texto da variante, então ele
 * funciona nas quatro sem que nenhuma precise declarar uma cor própria.
 */
function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="mr-2 size-4 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
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
        {isLoading ? <Spinner /> : null}
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
