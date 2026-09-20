import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background-color,box-shadow,transform,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-brand-700 text-white shadow-soft hover:bg-brand-800 hover:shadow-lifted dark:bg-brand-600 dark:hover:bg-brand-500': variant === 'primary',
            'border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:border-brand-400/70 hover:bg-[hsl(var(--muted))]': variant === 'secondary',
            'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]': variant === 'ghost',
            'bg-rose-700 text-white hover:bg-rose-800': variant === 'danger',
            'h-8 px-3 text-sm': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-12 px-6 text-base': size === 'lg',
          },
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
