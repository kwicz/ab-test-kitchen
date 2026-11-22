import type { PlatformId } from '../../shared/types.js';
import { convert } from './convert.js';
import { shoplift, shopifyRollouts } from './csv-platforms.js';
import { intelligems } from './intelligems.js';
import { optimizely } from './optimizely.js';
import type { PlatformAdapter } from './types.js';
import { vwo } from './vwo.js';

export const ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  optimizely,
  convert,
  vwo,
  intelligems,
  shoplift,
  'shopify-rollouts': shopifyRollouts,
};

export const isPlatformId = (v: string): v is PlatformId => v in ADAPTERS;
