import type { RestaurantLogo } from '@/types/domain';
import { LOGO_MAX_EDGE } from '@/utils/image';
import { ImageField } from './ImageField';

export interface LogoFieldProps {
  value: RestaurantLogo | null;
  onChange: (logo: RestaurantLogo | null) => void;
  disabled?: boolean;
}

/** Restaurant logo picker — ImageField preset with logo wording and sizing. */
export function LogoField({ value, onChange, disabled }: LogoFieldProps) {
  return (
    <ImageField
      value={value}
      onChange={onChange}
      disabled={disabled}
      label="Logo"
      idPrefix="logo"
      maxEdge={LOGO_MAX_EDGE}
      uploadLabel="Upload logo"
    />
  );
}
