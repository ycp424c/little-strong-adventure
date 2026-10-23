import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
const buttonVariants = cva('button', { variants: { variant: { default: 'button-primary', outline: 'button-outline', ghost: 'button-ghost' }, size: { default: '', icon: 'button-icon', large: 'button-large' } }, defaultVariants: { variant: 'default', size: 'default' } })
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => { const Comp = asChild ? Slot : 'button'; return <Comp data-slot="button" className={twMerge(clsx(buttonVariants({ variant, size, className })))} ref={ref} {...props} /> })
Button.displayName = 'Button'
