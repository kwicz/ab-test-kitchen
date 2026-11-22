/**
 * Demo kitchen: fictional clients and tests, simulated day by day.
 *
 * Each platform connector turns these simulations into that platform's own
 * API or export shape, then runs its real normalizer over it. So the demo
 * exercises the same parsing code a live connection would.
 */
import type { DailyPoint, Decision, PlatformId, PlatformStatus } from '../../shared/types.js';

export interface Scenario {
  key: string;
  platform: PlatformId;
  client: string;
  name: string;
  hypothesis: string;
  url: string;
  metric: string;
  status: PlatformStatus;
  /** Days since launch. null for drafts. */
  startedDaysAgo: number | null;
  /** For stopped tests: how many days it ran. */
  ranDays?: number;
  dailyPerArm: number;
  baseRate: number;
  /** Relative lift of each non-control variant. */
  lifts: number[];
  variantNames: string[];
  aov: number;
  /** Per-variant AOV multiplier (price tests). Defaults to 1. */
  aovMultipliers?: number[];
  /** App-side data applied after import (the platform does not know about these). */
  decision?: { decision: Decision; variantIndex?: number; notes: string };
}

export const SCENARIOS: Scenario[] = [
  // Ashgrove Home (Optimizely)
  { key: 'opt-1001', platform: 'optimizely', client: 'Ashgrove Home', name: 'Sticky add-to-cart on PDP', hypothesis: 'Keeping the add-to-cart button in view while shoppers scroll long PDPs will lift orders.', url: 'ashgrovehome.com/products/*', metric: 'Orders', status: 'running', startedDaysAgo: 18, dailyPerArm: 1500, baseRate: 0.031, lifts: [0.12], variantNames: ['Original', 'Sticky bar'], aov: 142 },
  { key: 'opt-1002', platform: 'optimizely', client: 'Ashgrove Home', name: 'Room-scene imagery first in gallery', hypothesis: 'Leading with styled room photos helps shoppers picture the piece at home.', url: 'ashgrovehome.com/products/*', metric: 'Orders', status: 'running', startedDaysAgo: 7, dailyPerArm: 1100, baseRate: 0.028, lifts: [0.05, -0.02], variantNames: ['Original', 'Room scene first', 'Detail shot first'], aov: 138 },
  { key: 'opt-1003', platform: 'optimizely', client: 'Ashgrove Home', name: 'Free swatch offer in cart', hypothesis: 'Offering free fabric swatches reduces sofa purchase anxiety.', url: 'ashgrovehome.com/cart', metric: 'Orders', status: 'stopped', startedDaysAgo: 62, ranDays: 28, dailyPerArm: 1300, baseRate: 0.029, lifts: [0.17], variantNames: ['Original', 'Swatch offer'], aov: 151, decision: { decision: 'winner', variantIndex: 1, notes: 'Shipped to 100%. Try the swatch prompt on PDP next.' } },
  { key: 'opt-1004', platform: 'optimizely', client: 'Ashgrove Home', name: 'Delivery-date estimator on PDP', hypothesis: 'A concrete delivery date beats "ships in 2-3 weeks" copy.', url: 'ashgrovehome.com/products/*', metric: 'Orders', status: 'draft', startedDaysAgo: null, dailyPerArm: 1200, baseRate: 0.03, lifts: [0.08], variantNames: ['Original', 'Delivery date'], aov: 140 },

  // Brine & Barrel (Convert + Intelligems)
  { key: 'cv-2201', platform: 'convert', client: 'Brine & Barrel', name: 'Bundle builder: pick any 4 jars', hypothesis: 'A build-your-own bundle raises order rate for first-time buyers.', url: 'brineandbarrel.co/collections/all', metric: 'Purchases', status: 'running', startedDaysAgo: 21, dailyPerArm: 2100, baseRate: 0.034, lifts: [0.015], variantNames: ['Original', 'Bundle builder'], aov: 46 },
  { key: 'cv-2202', platform: 'convert', client: 'Brine & Barrel', name: 'Recipe block above reviews', hypothesis: 'Showing what to make with the pickles gives shoppers a reason to buy now.', url: 'brineandbarrel.co/products/*', metric: 'Purchases', status: 'running', startedDaysAgo: 9, dailyPerArm: 1800, baseRate: 0.033, lifts: [0.22], variantNames: ['Original', 'Recipe block'], aov: 44 },
  { key: 'cv-2203', platform: 'convert', client: 'Brine & Barrel', name: 'Subscribe & save selected by default', hypothesis: 'Defaulting to subscription lifts subscriber share without hurting conversion.', url: 'brineandbarrel.co/products/*', metric: 'Purchases', status: 'draft', startedDaysAgo: null, dailyPerArm: 1800, baseRate: 0.033, lifts: [0], variantNames: ['Original', 'Subscribe default'], aov: 44 },
  { key: 'ig-3301', platform: 'intelligems', client: 'Brine & Barrel', name: 'Free shipping threshold: $45 vs $55', hypothesis: 'A higher threshold raises AOV more than it costs in conversion.', url: 'brineandbarrel.co', metric: 'Orders', status: 'running', startedDaysAgo: 16, dailyPerArm: 900, baseRate: 0.036, lifts: [0.04], variantNames: ['$45 threshold', '$55 threshold'], aov: 47, aovMultipliers: [1, 1.09] },

  // Mosswood Outfitters (Convert + Shoplift)
  { key: 'cv-2204', platform: 'convert', client: 'Mosswood Outfitters', name: 'Size-finder quiz on collection pages', hypothesis: 'A fit quiz up front reduces size uncertainty for outerwear.', url: 'mosswood.com/collections/*', metric: 'Purchases', status: 'stopped', startedDaysAgo: 50, ranDays: 24, dailyPerArm: 1600, baseRate: 0.022, lifts: [-0.09], variantNames: ['Original', 'Quiz entry'], aov: 188, decision: { decision: 'loser', notes: 'Quiz added friction. Learning: shoppers want the size chart, not a quiz.' } },
  { key: 'cv-2205', platform: 'convert', client: 'Mosswood Outfitters', name: 'Trust badges row in checkout', hypothesis: 'Compact trust badges near the pay button reduce last-step drop-off.', url: 'mosswood.com/checkout', metric: 'Purchases', status: 'paused', startedDaysAgo: 12, dailyPerArm: 700, baseRate: 0.025, lifts: [0.03], variantNames: ['Original', 'Badge row'], aov: 176 },
  { key: 'sl-4401', platform: 'shoplift', client: 'Mosswood Outfitters', name: 'Homepage hero: lifestyle video vs product grid', hypothesis: 'Video sets the brand mood and pulls shoppers deeper into the catalog.', url: 'mosswood.com', metric: 'Orders', status: 'running', startedDaysAgo: 15, dailyPerArm: 2400, baseRate: 0.019, lifts: [0.14], variantNames: ['Product grid', 'Lifestyle video'], aov: 182 },
  { key: 'sl-4402', platform: 'shoplift', client: 'Mosswood Outfitters', name: 'Template test: new PDP layout', hypothesis: 'A two-column PDP with specs up top suits technical gear shoppers.', url: 'mosswood.com/products/*', metric: 'Orders', status: 'draft', startedDaysAgo: null, dailyPerArm: 2000, baseRate: 0.02, lifts: [0], variantNames: ['Current template', 'New template'], aov: 180 },

  // Kelp & Co. Skincare (VWO + Shopify Rollouts)
  { key: 'vwo-501', platform: 'vwo', client: 'Kelp & Co. Skincare', name: 'Regimen builder on PDP', hypothesis: 'Showing the full routine lifts orders and units per order.', url: 'kelpandco.com/products/*', metric: 'Orders', status: 'running', startedDaysAgo: 19, dailyPerArm: 1200, baseRate: 0.041, lifts: [0.11, 0.03], variantNames: ['Control', 'Regimen builder', 'Regimen list'], aov: 64 },
  { key: 'vwo-502', platform: 'vwo', client: 'Kelp & Co. Skincare', name: 'Ingredient glossary tooltips', hypothesis: 'Explaining ingredients inline builds trust with ingredient-savvy shoppers.', url: 'kelpandco.com/products/*', metric: 'Orders', status: 'running', startedDaysAgo: 4, dailyPerArm: 1000, baseRate: 0.04, lifts: [0.02], variantNames: ['Control', 'Tooltips'], aov: 61 },
  { key: 'vwo-503', platform: 'vwo', client: 'Kelp & Co. Skincare', name: 'Before/after gallery on homepage', hypothesis: 'Real results imagery convinces skeptical first-time visitors.', url: 'kelpandco.com', metric: 'Orders', status: 'stopped', startedDaysAgo: 75, ranDays: 30, dailyPerArm: 1100, baseRate: 0.038, lifts: [0.01], variantNames: ['Control', 'Gallery'], aov: 59, decision: { decision: 'inconclusive', notes: 'Flat at full sample. Gallery stays off; revisit with video testimonials.' } },
  { key: 'sr-601', platform: 'shopify-rollouts', client: 'Kelp & Co. Skincare', name: 'Holiday theme vs evergreen theme', hypothesis: 'A seasonal theme lifts gifting intent during the holidays.', url: 'kelpandco.com', metric: 'Orders', status: 'running', startedDaysAgo: 11, dailyPerArm: 3000, baseRate: 0.027, lifts: [-0.03], variantNames: ['Evergreen theme', 'Holiday theme'], aov: 66 },

  // Fennel Pet Supply (Intelligems + Shopify Rollouts)
  { key: 'ig-3302', platform: 'intelligems', client: 'Fennel Pet Supply', name: 'Price test: $34 vs $38 on 30-lb kibble', hypothesis: 'Loyal kibble buyers are price-insensitive enough that $38 wins on profit.', url: 'fennelpet.com/products/kibble-30lb', metric: 'Orders', status: 'running', startedDaysAgo: 24, dailyPerArm: 1700, baseRate: 0.045, lifts: [-0.04], variantNames: ['$34', '$38'], aov: 52, aovMultipliers: [1, 1.11] },
  { key: 'ig-3303', platform: 'intelligems', client: 'Fennel Pet Supply', name: 'Shipping protection: opt-out vs opt-in', hypothesis: 'Pre-checked shipping protection does not hurt conversion.', url: 'fennelpet.com/cart', metric: 'Orders', status: 'stopped', startedDaysAgo: 45, ranDays: 21, dailyPerArm: 1500, baseRate: 0.044, lifts: [0.11], variantNames: ['Opt-in', 'Opt-out'], aov: 49, decision: { decision: 'winner', variantIndex: 1, notes: 'Surprise winner. Monitor refund requests for a month.' } },
  { key: 'sr-602', platform: 'shopify-rollouts', client: 'Fennel Pet Supply', name: 'New navigation menu', hypothesis: 'Shop-by-pet navigation gets shoppers to the right food faster.', url: 'fennelpet.com', metric: 'Orders', status: 'running', startedDaysAgo: 2, dailyPerArm: 2000, baseRate: 0.03, lifts: [0], variantNames: ['Current menu', 'Shop by pet'], aov: 50 },
];

export interface SimVariant {
  key: string;
  name: string;
  isControl: boolean;
  visitors: number;
  conversions: number;
  revenue: number;
  daily: (DailyPoint & { revenue: number })[];
}

export interface Simulation {
  scenario: Scenario;
  startedAt: string | null;
  endedAt: string | null;
  variants: SimVariant[];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function simulate(s: Scenario, now: Date): Simulation {
  const rand = rng(hash(s.key));
  const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const variants: SimVariant[] = s.variantNames.map((name, i) => ({
    key: `${s.key}-v${i}`,
    name,
    isControl: i === 0,
    visitors: 0,
    conversions: 0,
    revenue: 0,
    daily: [],
  }));

  if (s.startedDaysAgo === null) return { scenario: s, startedAt: null, endedAt: null, variants };

  const start = new Date(today.getTime() - s.startedDaysAgo * DAY);
  const days = s.ranDays ?? s.startedDaysAgo;
  const end = s.ranDays ? new Date(start.getTime() + s.ranDays * DAY) : null;

  for (let d = 0; d < days; d++) {
    const date = new Date(start.getTime() + d * DAY);
    const weekday = date.getUTCDay();
    const dayFactor = weekday === 0 || weekday === 6 ? 1.18 : 1;
    variants.forEach((v, i) => {
      const rate = s.baseRate * (i === 0 ? 1 : 1 + (s.lifts[i - 1] ?? 0));
      const visitors = Math.round(s.dailyPerArm * dayFactor * (0.9 + 0.2 * rand()));
      const expected = visitors * rate;
      const conversions = Math.max(0, Math.round(expected + gauss() * Math.sqrt(expected * (1 - rate))));
      const aov = s.aov * (s.aovMultipliers?.[i] ?? 1) * (0.93 + 0.14 * rand());
      const revenue = Math.round(conversions * aov * 100) / 100;
      v.visitors += visitors;
      v.conversions += conversions;
      v.revenue += revenue;
      v.daily.push({ date: isoDate(date), visitors, conversions, revenue });
    });
  }
  variants.forEach((v) => (v.revenue = Math.round(v.revenue * 100) / 100));

  return { scenario: s, startedAt: start.toISOString(), endedAt: end?.toISOString() ?? null, variants };
}

export function simulationsFor(platform: PlatformId, now: Date): Simulation[] {
  return SCENARIOS.filter((s) => s.platform === platform).map((s) => simulate(s, now));
}
