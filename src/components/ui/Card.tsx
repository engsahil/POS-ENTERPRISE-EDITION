import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevation?: 'flat' | 'raised';
  children?: ReactNode;
}

export function Card({
  padding = 'md',
  elevation = 'flat',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(styles.card, styles[padding], styles[elevation], className)}
      {...props}
    >
      {children}
    </div>
  );
}
