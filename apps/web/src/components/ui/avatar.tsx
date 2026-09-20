import { cn } from '@/lib/utils';

const HUES = [
  'bg-brand-700', 'bg-teal-700', 'bg-emerald-800', 'bg-cyan-800',
  'bg-slate-600', 'bg-stone-600', 'bg-lime-800', 'bg-brand-900',
];

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const hue = HUES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % HUES.length];

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={cn('rounded-[28%] object-cover', SIZES[size], className)} />;
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-[28%] font-semibold text-white',
        SIZES[size],
        hue,
        className,
      )}
    >
      {initials || '?'}
    </div>
  );
}
