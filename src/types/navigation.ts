import type { ComponentType, SVGProps } from 'react';

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  /** Stable key used for lists and analytics. */
  id: string;
  label: string;
  /** Short hint shown in the sidebar under the label. */
  description?: string;
  path: string;
  icon: IconComponent;
  /** Show in the mobile bottom tab bar. */
  primary?: boolean;
  /** Match child routes as active (e.g. /inventory/:id). */
  matchChildren?: boolean;
}
