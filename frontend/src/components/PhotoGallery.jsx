/**
 * PhotoGallery — Responsive grid + lightbox for journal/trip photos.
 *
 * Props:
 *  - photos {Array}   [{id, url, thumbnail_url?, caption?}]
 *  - onDelete? {fn}   If provided, shows delete button per photo
 *  - className {string}
 *  - columns {number} Grid columns on md+ screens (default 3)
 */
import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, Trash2 } from 'lucide-react';

const PhotoGallery = ({ photos = [], onDelete, className = '', columns = 3 }) => {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const open = useCallback((i) => setLightboxIndex(i), []);
  const close = useCallback(() => setLightboxIndex(null), []);

  const prev = useCallback(() =>
    setLightboxIndex(i => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() =>
    setLightboxIndex(i => (i + 1) % photos.length), [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    if (lightboxIndex == null) return;
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, prev, next, close]);

  if (photos.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 text-base-content/40 ${className}`}>
        <ZoomIn size={32} className="mb-2 opacity-30" />
        <p className="text-sm">No photos yet</p>
      </div>
    );
  }

  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  }[columns] || 'grid-cols-2 md:grid-cols-3';

  const current = lightboxIndex != null ? photos[lightboxIndex] : null;

  return (
    <>
      <div className={`grid ${gridCols} gap-2 ${className}`}>
        {photos.map((photo, i) => (
          <div
            key={photo.id || photo.url || i}
            className="relative group aspect-square rounded-xl overflow-hidden cursor-pointer bg-base-200"
            onClick={() => open(i)}
          >
            <img
              src={photo.thumbnail_url || photo.url}
              alt={photo.caption || `Photo ${i + 1}`}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(photo); }}
                className="absolute top-2 right-2 p-1 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-error transition-all"
                title="Delete photo"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={close}
        >
          <button
            onClick={(e) => { e.stopPropagation(); close(); }}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
          >
            <X size={20} />
          </button>

          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-4 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-16 p-2 rounded-xl bg-white/10 text-white hover:bg-white/20"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          <div className="max-w-4xl max-h-[90vh] flex flex-col items-center px-16" onClick={(e) => e.stopPropagation()}>
            <img
              src={current.url}
              alt={current.caption || 'Photo'}
              className="max-w-full max-h-[80vh] rounded-xl object-contain"
            />
            {current.caption && (
              <p className="mt-3 text-white/80 text-sm text-center">{current.caption}</p>
            )}
            <p className="mt-1 text-white/40 text-xs">
              {lightboxIndex + 1} / {photos.length}
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default PhotoGallery;
