// Dashboard terminology that flips with an organization's capture mode.
// Pop-up orgs (Second Servings) say "Pop-Up Logs", cart orgs (Second Mile)
// say "Cart Logs", gleaning orgs (Glean Kentucky) keep it simple: "Logs".
//
// Every field is a COMPLETE string for one specific spot in the UI — no
// word-by-word composition, so no mode can produce awkward phrasing.

const TERMS = {
  popup: {
    navLabel: 'Pop-Up Logs',
    overviewSubtitle: 'Pop-up rescue activity, last 30 days',
    loggedLabel: 'Pop-ups logged',
    recentHeading: 'Recent pop-up logs',
    loadingLabel: 'Loading pop-up…',
    notFoundMsg: 'Pop-up not found.',
    backAllLabel: 'All pop-up logs',
    emptyTableMsg: 'No pop-up logs yet.',
    sitesSubtitle: 'Pop-up rescue history for a single location',
    noSitesMsg: 'No sites with logged pop-ups yet.',
    noSiteLogsMsg: 'No pop-up logs at this site yet.',
    siteCountLabel: 'Pop-ups',
    avgPerLabel: 'Avg per pop-up',
    weightPerHeading: 'Weight rescued per pop-up',
    allAtSiteHeading: 'All pop-up logs at this site',
    downloadNoun: 'pop-up',
    countingMsg: 'Counting matching pop-ups…',
    countNoun: 'pop-up log',
    rowPerNoun: 'pop-up',
  },
  cart: {
    navLabel: 'Cart Logs',
    overviewSubtitle: 'Cart rescue activity, last 30 days',
    loggedLabel: 'Carts logged',
    recentHeading: 'Recent cart logs',
    loadingLabel: 'Loading cart…',
    notFoundMsg: 'Cart log not found.',
    backAllLabel: 'All cart logs',
    emptyTableMsg: 'No cart logs yet.',
    sitesSubtitle: 'Cart rescue history for a single location',
    noSitesMsg: 'No sites with logged carts yet.',
    noSiteLogsMsg: 'No cart logs at this site yet.',
    siteCountLabel: 'Carts',
    avgPerLabel: 'Avg per cart',
    weightPerHeading: 'Weight rescued per cart',
    allAtSiteHeading: 'All cart logs at this site',
    downloadNoun: 'cart',
    countingMsg: 'Counting matching carts…',
    countNoun: 'cart log',
    rowPerNoun: 'cart',
  },
  gleaning: {
    navLabel: 'Logs',
    overviewSubtitle: 'Rescue activity, last 30 days',
    loggedLabel: 'Logs recorded',
    recentHeading: 'Recent logs',
    loadingLabel: 'Loading log…',
    notFoundMsg: 'Log not found.',
    backAllLabel: 'All logs',
    emptyTableMsg: 'No logs yet.',
    sitesSubtitle: 'Rescue history for a single location',
    noSitesMsg: 'No sites with logs yet.',
    noSiteLogsMsg: 'No logs at this site yet.',
    siteCountLabel: 'Logs',
    avgPerLabel: 'Avg per log',
    weightPerHeading: 'Weight rescued per log',
    allAtSiteHeading: 'All logs at this site',
    downloadNoun: 'log',
    countingMsg: 'Counting matching logs…',
    countNoun: 'log',
    rowPerNoun: 'log',
  },
};

export function getTerms(captureMode) {
  const mode = ['cart', 'gleaning'].includes(captureMode) ? captureMode : 'popup';
  return { mode, cart: mode === 'cart', gleaning: mode === 'gleaning', ...TERMS[mode] };
}
