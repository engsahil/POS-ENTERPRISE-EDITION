import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { ImageIcon, TrashIcon, UploadIcon } from '@/components/ui/Icons';
import type { StoredImage } from '@/types/domain';
import {
  formatBytes,
  LOGO_ACCEPTED_TYPES,
  LOGO_MAX_EDGE,
  optimiseImage,
} from '@/utils/image';
import styles from './LogoField.module.css';

export interface ImageFieldProps {
  value: StoredImage | null;
  onChange: (image: StoredImage | null) => void;
  disabled?: boolean;
  /** Visible field label. */
  label?: string;
  /** Longest edge the stored image is downscaled to. */
  maxEdge?: number;
  /** Label for the upload button when no image is set. */
  uploadLabel?: string;
  /** Overrides the default hint shown when the field is empty. */
  emptyHint?: string;
  /** Distinguishes the preview and file input when several are on a page. */
  idPrefix?: string;
}

/**
 * Image picker with in-browser optimisation.
 *
 * The chosen file is downscaled and re-encoded before it is handed upward,
 * so only a few kilobytes are ever persisted.
 */
export function ImageField({
  value,
  onChange,
  disabled,
  label = 'Image',
  maxEdge = LOGO_MAX_EDGE,
  uploadLabel = 'Upload image',
  emptyHint,
  idPrefix = 'image',
}: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labelId = `${idPrefix}-label`;
  const altText = `${label} preview`;

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      const optimised = await optimiseImage(file, maxEdge);
      onChange({
        dataUrl: optimised.dataUrl,
        type: optimised.type,
        width: optimised.width,
        height: optimised.height,
        bytes: optimised.bytes,
        fileName: file.name,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'That image could not be used.',
      );
    } finally {
      setBusy(false);
      // Allow re-selecting the same file after a removal.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.label} id={labelId}>
        {label}
      </span>

      <div className={styles.row}>
        <div className={styles.preview} aria-live="polite">
          {value ? (
            <img src={value.dataUrl} alt={altText} className={styles.image} />
          ) : (
            <span className={styles.placeholder} aria-hidden="true">
              <ImageIcon width={22} height={22} />
            </span>
          )}
        </div>

        <div className={styles.controls}>
          <div className={styles.buttons}>
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
              leadingIcon={<UploadIcon width={16} height={16} />}
              aria-describedby={labelId}
            >
              {busy ? 'Optimising' : value ? 'Replace' : uploadLabel}
            </Button>

            {value ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled || busy}
                onClick={() => {
                  setError(null);
                  onChange(null);
                }}
                leadingIcon={<TrashIcon width={16} height={16} />}
              >
                Remove
              </Button>
            ) : null}
          </div>

          <p className={styles.meta}>
            {value
              ? `${value.fileName} — ${formatBytes(value.bytes)}${
                  value.width ? ` · ${value.width}x${value.height}` : ''
                }`
              : (emptyHint ??
                `PNG, JPG, WebP or SVG. Resized to ${maxEdge}px and compressed automatically.`)}
          </p>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPTED_TYPES.join(',')}
        className={styles.input}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
