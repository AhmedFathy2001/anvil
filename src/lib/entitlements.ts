// What a clan is allowed to do right now — the one switch between "generous now" and "tighten later".
//
// The freemium model (lib/plans) names tiers and capabilities, but during the growth phase we are
// deliberately GENEROUS: everything is on for everyone, and a premium feature shows an upsell nudge
// rather than a locked door. `FREEMIUM_ENFORCED=true` is the single switch that turns the caps and
// capability gates from decoration into enforcement, once there is critical mass. Until then `clanCan`
// answers true for everything, so the gates can be wired through the app today and simply not bite yet.

import { CAPABILITY_MIN_PLAN, PLANS, planHasCapability, planOf, type Capability, type PlanId } from '@/lib/plans';

/** The "tighten later" switch. Off by default — the generous phase. */
export function freemiumEnforced(): boolean {
  return process.env.FREEMIUM_ENFORCED === 'true';
}

/**
 * May a clan on this plan use this capability? Generous phase → always yes. Enforced → gated by tier.
 * Pass the clan's stored `plan` string (planOf falls back to Free).
 */
export function clanCan(clanPlan: string | null | undefined, capability: Capability): boolean {
  if (!freemiumEnforced()) return true;
  return planHasCapability(planOf(clanPlan), capability);
}

/** The tier a clan needs to unlock a capability, for upsell copy ("a Silver feature"). */
export function minPlanNameFor(capability: Capability): string {
  const id: PlanId = CAPABILITY_MIN_PLAN[capability];
  return PLANS[id].name;
}
