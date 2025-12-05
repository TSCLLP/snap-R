export type Role = 'photographer' | 'agent' | 'broker';
export type Region = 'US' | 'IN' | 'UAE';

export type ToneProfile = 'creative' | 'mls-natural';
export type WatermarkMode = 'none' | 'mandatory';

export interface Policy {
  toneProfile: ToneProfile;
  watermark: {
    staging: WatermarkMode;
    text?: string;
  };
}

type PolicyKey = `${Region}:${Role}`;

const POLICIES: Record<PolicyKey, Policy> = {
  // US MARKET
  'US:photographer': {
    toneProfile: 'creative',
    watermark: {
      staging: 'none',
    },
  },
  'US:agent': {
    toneProfile: 'mls-natural',
    watermark: {
      staging: 'mandatory',
      text: 'Virtually Staged',
    },
  },
  'US:broker': {
    toneProfile: 'mls-natural',
    watermark: {
      staging: 'mandatory',
      text: 'Virtually Staged',
    },
  },

  // INDIA MARKET (placeholder defaults)
  'IN:photographer': {
    toneProfile: 'creative',
    watermark: {
      staging: 'none',
    },
  },
  'IN:agent': {
    toneProfile: 'mls-natural',
    watermark: {
      staging: 'mandatory',
      text: 'Virtually Staged',
    },
  },
  'IN:broker': {
    toneProfile: 'mls-natural',
    watermark: {
      staging: 'mandatory',
      text: 'Virtually Staged',
    },
  },

  // UAE MARKET (placeholder defaults)
  'UAE:photographer': {
    toneProfile: 'creative',
    watermark: {
      staging: 'none',
    },
  },
  'UAE:agent': {
    toneProfile: 'mls-natural',
    watermark: {
      staging: 'mandatory',
      text: 'Virtually Staged',
    },
  },
  'UAE:broker': {
    toneProfile: 'mls-natural',
    watermark: {
      staging: 'mandatory',
      text: 'Virtually Staged',
    },
  },
};

const DEFAULT_POLICY: Policy = {
  toneProfile: 'creative',
  watermark: {
    staging: 'none',
  },
};

export function getPolicy(region: string | undefined, userRole: string | undefined): Policy {
  const normalizedRegion = (region || 'US').toUpperCase() as Region;
  const normalizedRole = (userRole || 'photographer') as Role;

  const key = `${normalizedRegion}:${normalizedRole}` as PolicyKey;
  return POLICIES[key] || DEFAULT_POLICY;
}

