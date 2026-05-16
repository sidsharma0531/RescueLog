'use client';

import { useState } from 'react';

// Clickable photo thumbnails with a tap-to-enlarge lightbox.
export default function PhotoGallery({ photos }) {
  const [active, setActive] = useState(null);

  if (!photos || photos.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        No photos for this pop-up.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, i) => (
          <button
            key={photo.id || i}
            onClick={() => setActive(photo)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.photo_url}
              alt={`Pop-up photo ${i + 1}`}
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
            {photo.processing_status === 'failed' && (
              <span className="absolute bottom-1 left-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                AI failed
              </span>
            )}
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={active.photo_url}
            alt="Pop-up photo"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          <button
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-gray-800"
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}
