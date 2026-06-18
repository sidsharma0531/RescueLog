// Dashboard terminology that flips with an organization's capture mode.
// Cart-mode orgs (e.g. Second Mile) see "Cart Log(s)" / "Carts"; pop-up orgs
// (e.g. Second Servings) keep "Pop-Up Log(s)" / "Pop-Ups".
export function getTerms(captureMode) {
  const cart = captureMode === 'cart';
  return {
    cart,
    logTitle: cart ? 'Cart Log' : 'Pop-Up Log', // Title Case, singular
    logTitlePlural: cart ? 'Cart Logs' : 'Pop-Up Logs', // Title Case, plural
    logWord: cart ? 'cart' : 'pop-up', // lowercase, singular (inline)
    logWordPlural: cart ? 'carts' : 'pop-ups', // lowercase, plural (inline)
    short: cart ? 'Carts' : 'Pop-Ups', // short Title Case plural
  };
}
