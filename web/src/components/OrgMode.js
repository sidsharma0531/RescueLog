'use client';

import { createContext, useContext } from 'react';
import { getTerms } from '@/lib/terms';

// Carries the signed-in admin's org capture mode down the dashboard tree so
// client pages can render pop-up vs cart terminology. Set once by the dashboard
// layout from the session.
const CaptureModeContext = createContext('popup');

export function OrgModeProvider({ captureMode, children }) {
  return (
    <CaptureModeContext.Provider value={captureMode === 'cart' ? 'cart' : 'popup'}>
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
