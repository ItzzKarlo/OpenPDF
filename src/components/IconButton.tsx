import type { ComponentType, ButtonHTMLAttributes } from 'react';
import type { LucideProps } from 'lucide-react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<LucideProps>;
  label: string;
  active?: boolean;
}

export function IconButton({ icon: Icon, label, active, className = '', ...props }: Props) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? 'active' : ''} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      {...props}
    >
      <Icon size={17} strokeWidth={1.8} />
    </button>
  );
}
