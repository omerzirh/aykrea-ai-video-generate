import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create the Supabase client with explicit localStorage persistence
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our subscription plans
export type SubscriptionTier = 'free' | 'basic' | 'premium';

export interface UserSubscription {
  tier: SubscriptionTier;
  active: boolean;
  expiresAt: string | null;
  features: {
    maxImagesPerDay: number;
    maxVideosPerDay: number;
    maxVideoLength: number;
    highQualityGeneration: boolean;
  };
}

// Default subscription features by tier
export const subscriptionFeatures: Record<SubscriptionTier, UserSubscription['features']> = {
  free: {
    maxImagesPerDay: 5,
    maxVideosPerDay: 2,
    maxVideoLength: 5, // seconds
    highQualityGeneration: false,
  },
  basic: {
    maxImagesPerDay: 20,
    maxVideosPerDay: 10,
    maxVideoLength: 10, // seconds
    highQualityGeneration: false,
  },
  premium: {
    maxImagesPerDay: 100,
    maxVideosPerDay: 30,
    maxVideoLength: 30, // seconds
    highQualityGeneration: true,
  },
};
