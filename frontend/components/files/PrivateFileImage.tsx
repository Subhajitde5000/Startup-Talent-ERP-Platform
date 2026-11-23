'use client';

import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';

export default function PrivateFileImage({ fileId, alt, fallback }: { fileId: string; alt: string; fallback: ReactNode }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setUrl(''); setFailed(false);
    api.files.download(fileId, 'thumbnail', controller.signal)
      .then(result => { if (!controller.signal.aborted) setUrl(result.url); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [fileId]);
  if (failed) return <span className="text-center" title="Could not load the private image. Refresh to retry.">{fallback}<small className="block text-[10px]">Image unavailable</small></span>;
  if (!url) return <span aria-label="Loading image">{fallback}</span>;
  // Signed R2 URLs are short-lived and remain only in component memory.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className="h-full w-full rounded-xl object-cover" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
