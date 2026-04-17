import { useState, useRef, useEffect } from 'react';

/**
 * OptimizedImage — a drop-in `<img>` replacement that provides:
 *
 *   • Lazy loading (native `loading="lazy"` + IntersectionObserver fallback)
 *   • Automatic responsive `srcset` and `sizes` when the `srcset` or `widths`
 *     prop is supplied (see examples below)
 *   • WebP format hint via `<picture>` / `webpSrc` prop
 *   • Graceful placeholder shown while loading and on error
 *   • LQIP (Low Quality Image Placeholder) blur-up effect via the `lqip` prop
 *
 * Examples:
 *
 *   // Simple lazy image
 *   <OptimizedImage src="/photo.jpg" alt="Paris at sunset" />
 *
 *   // Responsive srcset — widths auto-generates URLs by substituting {w}
 *   <OptimizedImage
 *     src="/photo.jpg"
 *     widths={[320, 640, 960, 1280]}
 *     urlTemplate="/photo-{w}.jpg"
 *     sizes="(max-width: 640px) 100vw, 640px"
 *     alt="Paris at sunset"
 *   />
 *
 *   // Explicit srcset string
 *   <OptimizedImage
 *     src="/photo.jpg"
 *     srcSet="/photo-320.jpg 320w, /photo-640.jpg 640w"
 *     sizes="(max-width: 640px) 100vw, 640px"
 *     alt="Paris at sunset"
 *   />
 *
 *   // WebP with fallback
 *   <OptimizedImage src="/photo.jpg" webpSrc="/photo.webp" alt="…" />
 *
 *   // Blur-up LQIP placeholder
 *   <OptimizedImage src="/photo.jpg" lqip="/photo-placeholder.jpg" alt="…" />
 */
const OptimizedImage = ({
  src,
  webpSrc,
  srcSet,
  widths,
  urlTemplate,
  sizes = '100vw',
  alt = '',
  lqip,
  className = '',
  wrapperClassName = '',
  width,
  height,
  priority = false,
  onLoad,
  onError,
  ...rest
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  // Derive srcset from widths + urlTemplate if not provided explicitly
  const derivedSrcSet =
    srcSet ||
    (widths && urlTemplate
      ? widths.map((w) => `${urlTemplate.replace('{w}', w)} ${w}w`).join(', ')
      : undefined);

  // Trigger intersection observer for environments without native lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return;
    if ('loading' in HTMLImageElement.prototype) return; // native support — skip

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && imgRef.current) {
          const img = imgRef.current;
          if (img.dataset.src) img.src = img.dataset.src;
          if (img.dataset.srcset) img.srcset = img.dataset.srcset;
          observer.unobserve(img);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = (e) => {
    setLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e) => {
    setError(true);
    onError?.(e);
  };

  const imgProps = {
    ref: imgRef,
    alt,
    loading: priority ? 'eager' : 'lazy',
    decoding: 'async',
    width,
    height,
    onLoad: handleLoad,
    onError: handleError,
    className: [
      'transition-opacity duration-300',
      loaded ? 'opacity-100' : 'opacity-0',
      className,
    ]
      .filter(Boolean)
      .join(' '),
    ...rest,
  };

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-base-200 text-base-content/30 text-xs font-medium ${wrapperClassName || className}`}
        style={{ width, height }}
        role="img"
        aria-label={alt || 'Image unavailable'}
      >
        <span>Image unavailable</span>
      </div>
    );
  }

  const imageElement = webpSrc || derivedSrcSet ? (
    <picture className={wrapperClassName}>
      {lqip && !loaded && (
        <img
          src={lqip}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover filter blur-sm scale-105 transition-opacity duration-300 ${loaded ? 'opacity-0' : 'opacity-100'}`}
        />
      )}
      {webpSrc && <source type="image/webp" srcSet={webpSrc} sizes={sizes} />}
      {derivedSrcSet && <source srcSet={derivedSrcSet} sizes={sizes} />}
      <img src={src} {...imgProps} />
    </picture>
  ) : (
    <div className={`relative ${wrapperClassName}`}>
      {lqip && !loaded && (
        <img
          src={lqip}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover filter blur-sm scale-105 transition-opacity duration-300 ${loaded ? 'opacity-0' : 'opacity-100'}`}
        />
      )}
      <img src={src} {...imgProps} />
    </div>
  );

  return imageElement;
};

export default OptimizedImage;
