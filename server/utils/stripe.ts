import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is missing from environment variables');
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-04-30.basil', // Keep the original version to maintain type compatibility
});

// Define subscription tiers
export type SubscriptionTier = 'free' | 'basic' | 'premium';

// Define subscription features for each tier
export const subscriptionFeatures = {
  free: {
    maxImagesPerDay: 3,
    maxVideosPerDay: 1,
    maxVideoLength: 5,
    highQualityGeneration: false
  },
  basic: {
    maxImagesPerDay: 10,
    maxVideosPerDay: 5,
    maxVideoLength: 15,
    highQualityGeneration: false
  },
  premium: {
    maxImagesPerDay: 30,
    maxVideosPerDay: 15,
    maxVideoLength: 30,
    highQualityGeneration: true
  }
};

// Define subscription product IDs
export const SUBSCRIPTION_PRODUCTS = {
  BASIC: process.env.STRIPE_BASIC_PLAN_ID,
  PREMIUM: process.env.STRIPE_PREMIUM_PLAN_ID,
};

// Define subscription price IDs
export const SUBSCRIPTION_PRICES = {
  BASIC: process.env.STRIPE_BASIC_PRICE_ID,
  PREMIUM: process.env.STRIPE_PREMIUM_PRICE_ID,
};

// Map Stripe price IDs to subscription tiers
export const PRICE_ID_TO_TIER: Record<string, 'basic' | 'premium'> = {
  [process.env.STRIPE_BASIC_PRICE_ID || '']: 'basic',
  [process.env.STRIPE_PREMIUM_PRICE_ID || '']: 'premium',
};

// Create a checkout session for subscription
export const createCheckoutSession = async (
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) => {
  try {
    console.log('Creating checkout session with params:', {
      customerId,
      priceId,
      successUrl,
      cancelUrl
    });
    
    // Verify the price ID exists in Stripe
    try {
      const price = await stripe.prices.retrieve(priceId);
      console.log('Price verified in Stripe:', price.id);
    } catch (priceError) {
      console.error('Error retrieving price from Stripe:', priceError);
      throw new Error(`Invalid price ID: ${priceId}`);
    }
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    
    console.log('Checkout session created successfully:', {
      sessionId: session.id,
      url: session.url
    });
    
    return session;
  } catch (error) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};

// Create a customer in Stripe
export const createCustomer = async (email: string, name?: string) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
    });
    
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
};

// Retrieve a customer's subscriptions
export const getCustomerSubscriptions = async (customerId: string) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      expand: ['data.default_payment_method'],
    });
    
    return subscriptions.data;
  } catch (error) {
    console.error('Error retrieving customer subscriptions:', error);
    throw error;
  }
};

// Cancel a subscription
export const cancelSubscription = async (subscriptionId: string) => {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

// Create a portal session for managing subscriptions
export const createPortalSession = async (
  customerId: string,
  returnUrl: string
) => {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    
    return session;
  } catch (error) {
    console.error('Error creating portal session:', error);
    throw error;
  }
};
