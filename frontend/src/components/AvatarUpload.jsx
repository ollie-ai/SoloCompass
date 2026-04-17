import { useRef, useState } from 'react';
import { Camera, Loader, X } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_LABELS = 'JPEG, PNG, or WebP';

/**
 * AvatarUpload — standalone avatar upload component.
 * Renders the current avatar + an upload button. On file selection:
 *  - Validates file size (max 5MB) and MIME type (JPEG/PNG/WebP)
 *  - Uploads to PUT /api/users/me/avatar
 *  - Calls `onUpload(avatarUrl)` callback on success
 *
 * Props:
 *   currentUrl  — current avatar URL (string or null)
 *   displayName — display name for alt text / initials fallback
 *   onUpload    — callback(newUrl: string) called after successful upload
 *   size        — 'sm' | 'md' | 'lg' (default 'md')
 */
export default function AvatarUpload({ currentUrl, displayName = '', onUpload, size = 'md' }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-20 h-20',
    lg: 'w-28 h-28',
  };

  const buttonSizeClasses = {
    sm: 'w-5 h-5 bottom-0 right-0',
    md: 'w-7 h-7 bottom-0 right-0',
    lg: 'w-8 h-8 bottom-1 right-1',
  };

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const avatarUrl = preview || currentUrl;
  // Only allow blob: and https: URLs as image sources to prevent XSS and mixed-content
  const safeAvatarUrl = avatarUrl && /^(blob:|https:\/\/)/.test(avatarUrl) ? avatarUrl : null;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error(`Only ${ALLOWED_LABELS} images are allowed`);
      e.target.value = '';
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image must be smaller than 5 MB');
      e.target.value = '';
      return;
    }

    // Show immediate preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.put('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl = res.data.data.avatarUrl;
      setPreview(null);
      onUpload?.(newUrl);
      toast.success('Avatar updated!');
    } catch (err) {
      setPreview(null);
      toast.error(err.response?.data?.error?.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
      e.target.value = '';
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="relative inline-block">
      {/* Avatar display */}
      <div className={`${sizeClasses[size]} rounded-full overflow-hidden relative`}>
        {safeAvatarUrl ? (
          <img
            src={safeAvatarUrl}
            alt={displayName || 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-brand-vibrant/15 flex items-center justify-center font-bold text-brand-vibrant text-lg">
            {initials}
          </div>
        )}

        {/* Loading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
            <Loader className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Preview clear button */}
      {preview && !uploading && (
        <button
          type="button"
          onClick={clearPreview}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center hover:bg-error/80 transition-colors"
          title="Cancel"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Upload button */}
      {!uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`absolute ${buttonSizeClasses[size]} rounded-full bg-brand-vibrant text-white flex items-center justify-center hover:bg-green-600 transition-colors shadow-md`}
          title="Change avatar"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {/* Helper text */}
      <p className="text-xs text-base-content/40 mt-2 text-center">
        {ALLOWED_LABELS}, max 5 MB
      </p>
    </div>
  );
}
