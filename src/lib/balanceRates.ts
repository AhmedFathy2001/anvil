// Settings key for the admin's balance-rate overrides, which merge over the curated defaults in
// lib/balanceEffort.
//
// It lives here rather than in the balance route because a Next route module may only export
// handlers and a fixed set of config fields — anything else fails the generated route-type check
// (and so fails `next build`).
export const BALANCE_RATES_SETTING_KEY = 'balance_rates';
