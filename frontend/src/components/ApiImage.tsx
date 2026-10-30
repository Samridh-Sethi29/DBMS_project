import { useState } from 'react';
import ImagePlaceholder from '@/components/ImagePlaceholder';

export default function ApiImage({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <ImagePlaceholder label={`${alt} unavailable`} className={className} />;
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={className} loading="lazy" />;
}
