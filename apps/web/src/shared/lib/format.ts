export const formatFileSize = (size?: number | null) => {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return '—';
  }

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
