import {
  ImageManipulator,
  SaveFormat,
  manipulateAsync,
} from 'expo-image-manipulator';
import { MAX_PHOTO_DIMENSION, PHOTO_QUALITY } from '../constants/config';

// Downscales a captured photo to MAX_PHOTO_DIMENSION on its longest edge and
// re-encodes it as a compressed JPEG, keeping uploads small and fast.
//
// expo-image-manipulator's API changed across SDK versions — this tries the
// current context API, then the legacy manipulateAsync, then falls back to
// the original photo so capture never hard-fails on a resize problem.
export async function resizeForUpload(uri, width, height) {
  const longEdge = Math.max(width || 0, height || 0);
  const needsResize = longEdge > MAX_PHOTO_DIMENSION && width && height;
  const scale = needsResize ? MAX_PHOTO_DIMENSION / longEdge : 1;
  const size = needsResize
    ? { width: Math.round(width * scale), height: Math.round(height * scale) }
    : null;
  const jpeg = SaveFormat?.JPEG || 'jpeg';

  // Current (SDK 52+) context-based API — `ImageManipulator` is the new
  // object export with a chainable .manipulate().
  try {
    if (ImageManipulator && typeof ImageManipulator.manipulate === 'function') {
      const ctx = ImageManipulator.manipulate(uri);
      if (size) ctx.resize(size);
      const rendered = await ctx.renderAsync();
      const out = await rendered.saveAsync({
        compress: PHOTO_QUALITY,
        format: jpeg,
      });
      if (out?.uri) return out.uri;
    }
  } catch {
    /* try the legacy API next */
  }

  // Legacy API (older SDKs — may be undefined, which the check handles).
  try {
    if (typeof manipulateAsync === 'function') {
      const actions = size ? [{ resize: size }] : [];
      const out = await manipulateAsync(uri, actions, {
        compress: PHOTO_QUALITY,
        format: jpeg,
      });
      if (out?.uri) return out.uri;
    }
  } catch {
    /* fall through */
  }

  // Couldn't process — upload the original.
  return uri;
}
