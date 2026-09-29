/**
 * Inline SVG icon set — no icon library dependency.
 * 24x24 viewBox, 1.5 stroke weight for a light, premium line quality.
 */

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ---------- Primary navigation ---------- */

export const PosIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="7.5" width="18" height="13" rx="2.5" />
    <path d="M7.5 7.5v-2A2.5 2.5 0 0 1 10 3h4a2.5 2.5 0 0 1 2.5 2.5v2" />
    <path d="M7.5 12.5h5M7.5 16h3" />
    <circle cx="16.5" cy="14.5" r="1.75" />
  </Icon>
);

export const SalesIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 17.5 9 11.5l3.5 3.5 4-5" />
    <path d="M20.5 6.5v4h-4" />
    <path d="M3.5 3.5v17h17" />
  </Icon>
);

export const InventoryIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20.5 7.5 12 3 3.5 7.5l8.5 4.5 8.5-4.5Z" />
    <path d="M3.5 7.5v9L12 21l8.5-4.5v-9" />
    <path d="M12 12v9" />
  </Icon>
);

export const AdminIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3 4.5 6v5.5c0 4.2 3 8.1 7.5 9.5 4.5-1.4 7.5-5.3 7.5-9.5V6L12 3Z" />
    <path d="m9.25 12 2 2 3.5-3.75" />
  </Icon>
);

/* ---------- Actions & status ---------- */

export const MenuIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 7h17M3.5 12h17M3.5 17h17" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M17.5 6.5l-11 11M6.5 6.5l11 11" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Icon>
);

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </Icon>
);

export const OfflineIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m2.5 2.5 19 19" />
    <path d="M8.5 16.4a5 5 0 0 1 7 0" />
    <path d="M5 12.9a10 10 0 0 1 4-2.5" />
    <path d="M15 10.4a10 10 0 0 1 4 2.5" />
    <path d="M2 8.8a15 15 0 0 1 4.6-3" />
    <path d="M22 8.8a15 15 0 0 0-9.6-3.7" />
    <path d="M12 20h.01" />
  </Icon>
);

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16.5h.01" />
  </Icon>
);

export const UserIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="3.75" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const CustomersIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3 19.5a6 6 0 0 1 12 0" />
    <path d="M15.5 5.6a3.25 3.25 0 0 1 0 5.8" />
    <path d="M17 13.6a6 6 0 0 1 4 5.9" />
  </Icon>
);

export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.75a4 4 0 0 1 8 0v2.75" />
  </Icon>
);

export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m3 3 18 18" />
    <path d="M10.6 6.1A8.9 8.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 4" />
    <path d="M6.3 8.3A16.2 16.2 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icon>
);

export const LogoutIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14.5 5.5h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3" />
    <path d="M10 15.5 13.5 12 10 8.5" />
    <path d="M13.5 12h-9" />
  </Icon>
);

export const StoreIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 9.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9.5" />
    <path d="M3.2 9.5h17.6L19.2 4.6a1 1 0 0 0-.95-.68H5.75a1 1 0 0 0-.95.68Z" />
    <path d="M9.75 20v-5.2h4.5V20" />
  </Icon>
);

export const ImageIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="9.75" r="1.6" />
    <path d="m4.5 17 4.3-4.3a1.6 1.6 0 0 1 2.25 0L15.5 17" />
    <path d="m13.9 15.4 1.9-1.9a1.6 1.6 0 0 1 2.25 0l2.45 2.45" />
  </Icon>
);

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 15.5V4.75" />
    <path d="m8 8.5 4-3.75 4 3.75" />
    <path d="M4.5 15v3.25a1.25 1.25 0 0 0 1.25 1.25h12.5a1.25 1.25 0 0 0 1.25-1.25V15" />
  </Icon>
);

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.75 6.75h14.5" />
    <path d="M9.5 6.75V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.25" />
    <path d="M6.5 6.75 7.3 19a1 1 0 0 0 1 .95h7.4a1 1 0 0 0 1-.95l.8-12.25" />
    <path d="M10.5 10.5v6M13.5 10.5v6" />
  </Icon>
);

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const PhoneIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8.6 4.5H6.2A1.7 1.7 0 0 0 4.5 6.3c0 7.3 5.9 13.2 13.2 13.2a1.7 1.7 0 0 0 1.8-1.7v-2.4l-3.6-1.2-1.8 1.8a13.4 13.4 0 0 1-5.3-5.3l1.8-1.8Z" />
  </Icon>
);

export const MailIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="m4.5 7.5 6.4 4.7a2 2 0 0 0 2.2 0l6.4-4.7" />
  </Icon>
);

export const PinIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M19 10.4c0 5-7 10.1-7 10.1s-7-5.1-7-10.1a7 7 0 0 1 14 0Z" />
    <circle cx="12" cy="10.2" r="2.6" />
  </Icon>
);

export const MenuBookIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 5.25h5a2.5 2.5 0 0 1 2.5 2.5v11a2 2 0 0 0-2-2h-5.5Z" />
    <path d="M19.5 5.25h-5a2.5 2.5 0 0 0-2.5 2.5v11a2 2 0 0 1 2-2h5.5Z" />
  </Icon>
);

export const MinusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5.5 12h13" />
  </Icon>
);

export const LinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.3 1.3" />
    <path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.3-1.3" />
  </Icon>
);

export const TagIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 11V5.5a1 1 0 0 1 1-1H11l8 8a1.4 1.4 0 0 1 0 2l-5.5 5.5a1.4 1.4 0 0 1-2 0l-8-8Z" />
    <circle cx="8.6" cy="8.6" r="1.35" />
  </Icon>
);
