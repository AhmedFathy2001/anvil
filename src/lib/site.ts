// Single source of truth for the public-facing site details used across the legal + pricing pages.
// These pages exist to be a complete, honest front door and to satisfy the payment processor
// (Gumroad) website checklist: a clear product, pricing, terms, privacy, and refunds. Fill in the
// TODO fields before relying on them — a real business identity and a monitored contact are required.
//
// Adapted from Anvil.Admin when billing moved into the Site: the product is no longer per-clan managed
// HOSTING but one freemium PLATFORM (clans are spaces on it, free to start, paid tiers for more).

export const SITE = {
  name: 'Anvil',
  productName: 'Anvil — clan events platform',
  tagline: 'Run bingo, competitions, and cross-clan events for your Old School RuneScape clan.',
  domain: 'anvilosrs.com',
  baseUrl: 'https://anvilosrs.com',

  // Who operates Anvil. There is no registered company — Anvil is run by an individual, and this is
  // the name it trades under. Put your full legal name here instead if you ever want the terms to
  // name you personally (e.g. if you incorporate).
  legalEntity: 'Anvil',

  // How customers reach you for support, billing questions, and data requests.
  //
  // DISCORD, BECAUSE THE MAILBOX DOES NOT EXIST. `contactEmail` was help@anvilosrs.com with a note
  // saying inbound was still to be wired up — so the terms, the privacy policy and the refund page
  // each told people to write to an address that silently swallowed everything, which is worse than
  // naming no address at all: a data-subject request or a refund ask that vanishes still counts as
  // having been made.
  //
  // Set `contactEmail` again the day a mailbox answers, and the legal pages will offer both. A
  // reachable email is still the conventional channel for data requests, and worth having.
  contactEmail: null as string | null,
  supportDiscord: 'https://discord.gg/p9NkrTQmxN',

  // Payments are taken by Gumroad as Merchant of Record (our authorized reseller). Card data never
  // touches our servers — Gumroad handles it and remits tax/VAT on our behalf.
  paymentProcessor: 'Gumroad',
  processorTermsUrl: 'https://gumroad.com/terms',
  processorPrivacyUrl: 'https://gumroad.com/privacy',

  // Governing law for the Terms of Service. Set to where your business is established.
  jurisdiction: '[your jurisdiction]', // TODO: e.g. "England and Wales", "Egypt", your country/state

  // Shown as "Last updated" on the legal pages. Bump when you change the text.
  lastUpdated: 'August 29, 2026',
} as const;
