'use client';

import { createContext, useContext } from 'react';
import { getTerms } from '@/lib/terms';

// Carries the signed-in admin's org capture mode down the dashboard tree so
// client pages can render mode-specific terminology (pop-up / cart / gleaning)
// and the matching category profile. Set once by the dashboard layout from the
// session.
const CaptureModeContext = createContext('popup');

export function OrgModeProvider({ captureMode, children }) {
  // 'all' is the super admin's aggregate view (neutral terms, union categories).
  const mode = ['cart', 'gleaning', 'all'].includes(captureMode)
    ? captureMode
    : 'popup';
  return (
    <CaptureModeContext.Provider value={mode}>
      {children}
    </CaptureModeContext.Provider>
  );
}

export function useCaptureMode() {
  return useContext(CaptureModeContext);
}

export function useTerms() {
  return getTerms(useContext(CaptureModeContext));
}
