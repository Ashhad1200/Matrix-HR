import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * A real product screenshot, captured from the running app in both themes.
 * Files live in /public/landing as `<name>-light.jpg` and `<name>-dark.jpg` (1440x900).
 * `crop` fills a fixed-height parent, drawing the image `zoom` times the parent's width and
 * panning to (`x`%, `y`%) of the image, so a small cell can show one readable region of the UI.
 */
export function Shot({
  name,
  alt,
  priority,
  sizes = '(min-width: 1024px) 60vw, 100vw',
  crop,
  zoom = 1.6,
  x = 0,
  y = 0,
  className,
}: {
  name: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  crop?: boolean;
  zoom?: number;
  x?: number;
  y?: number;
  className?: string;
}) {
  const cropStyle = { width: `${zoom * 100}%`, transform: `translate(-${x}%, -${y}%)` };
  const img = (theme: 'light' | 'dark') => (
    <Image
      src={`/landing/${name}-${theme}.jpg`}
      alt={alt}
      sizes={crop ? '100vw' : sizes}
      priority={priority}
      width={1440}
      height={900}
      style={crop ? cropStyle : undefined}
      className={cn(
        crop ? 'absolute left-0 top-0 h-auto max-w-none' : 'h-auto w-full',
        theme === 'light' ? 'dark:hidden' : 'hidden dark:block',
      )}
    />
  );

  return (
    <div className={cn(crop ? 'absolute inset-0 overflow-hidden' : 'relative', className)}>
      {img('light')}
      {img('dark')}
    </div>
  );
}

/** Rounded frame with a tinted, layered shadow. */
export function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-frame', className)}>
      {children}
    </div>
  );
}
