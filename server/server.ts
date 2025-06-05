import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config as dotenvConfig } from 'dotenv';
// Using direct API calls instead of the SDK
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
// uuid is used in other utility files
import Stripe from 'stripe';
import * as bodyParser from 'body-parser';
import { 
  SUBSCRIPTION_PRICES, 
  SUBSCRIPTION_PRODUCTS, 
  PRICE_ID_TO_TIER
} from './utils/stripe';

// Define subscription tiers
type SubscriptionTier = 'free' | 'basic' | 'premium';

// Define subscription features for each tier
const subscriptionFeatures = {
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
import { storeGeneratedVideo, getUserVideos } from './utils/video-storage';
import { storeGeneratedImage, getUserImages } from './utils/image-storage';

dotenvConfig();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe with a valid API version
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16' as any, // Using a compatible API version
});

// Initialize Runway
const runwayApiKey = process.env.VITE_RUNWAY_API_KEY;
// We don't need to initialize the RunwayML SDK anymore
// Using our custom API wrapper instead

// Define custom functions to handle RunwayML operations
// This replaces the SDK with direct API calls
interface RunwayVideoParams {
  model: string;
  prompt: string;
  image_url?: string;
  mode: string; // Allow any string for mode to avoid type errors
  aspect_ratio: string;
}

interface RunwayResponse {
  task_id: string;
  status?: string;
  output?: string[] | string;
  input?: {
    prompt?: string;
    image_url?: string;
    mode?: string;
    aspect_ratio?: string;
  };
  metadata?: Record<string, any>;
}

const runwayAPI = {
  generateVideo: async (params: RunwayVideoParams): Promise<RunwayResponse> => {
    return fetch('https://api.runwayml.com/v1/generationTasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${runwayApiKey}`
      },
      body: JSON.stringify(params)
    }).then(res => res.json());
  },
  getTaskStatus: async (taskId: string): Promise<RunwayResponse> => {
    return fetch(`https://api.runwayml.com/v1/generationTasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${runwayApiKey}`
      }
    }).then(res => res.json());
  }
};

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsers
const jsonBodyParser = bodyParser.json();
const rawBodyParser = bodyParser.raw({ type: '*/*' });

// Define Supabase User type
interface SupabaseUser {
  id: string;
  email?: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  aud: string;
}

// Define extended request type with user property
interface AuthenticatedRequest extends Request {
  user: SupabaseUser;
  subscription?: {
    tier: string;
    features: {
      maxImagesPerDay: number;
      maxVideosPerDay: number;
      maxVideoLength: number;
      highQualityGeneration: boolean;
    };
  };
}

// Middleware to authenticate requests
const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    
    // Attach user to request
    (req as AuthenticatedRequest).user = user;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
    return;
  }
};

// Check subscription limits middleware
const checkSubscriptionLimits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const user = authenticatedReq.user;
    
    // Get user's subscription from Supabase
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error) {
      res.status(400).json({ error: 'Failed to retrieve subscription' });
      return;
    }
    
    // Default to free tier if no subscription found
    const tier = (data?.tier as SubscriptionTier) || 'free';
    const active = data?.active !== false; // Default to true if not explicitly false
    
    // Get subscription features
    const features = subscriptionFeatures[tier];
    
    // Check if subscription is active
    if (!active && tier !== 'free') {
      res.status(403).json({ 
        error: 'Your subscription is inactive',
        subscription: {
          tier,
          active,
          features
        }
      });
      return;
    }
    
    // Get today's usage
    const today = new Date().toISOString().split('T')[0];
    const requestType = req.path.includes('video') ? 'video' : 'image';
    
    const { data: usageData } = await supabase
      .from('usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('type', requestType)
      .eq('date', today)
      .single();
    
    const usageCount = usageData?.count || 0;
    
    // Check if user has reached their limit
    const limit = requestType === 'video' ? features.maxVideosPerDay : features.maxImagesPerDay;
    
    if (usageCount >= limit) {
      res.status(403).json({ 
        error: `You have reached your daily ${requestType} generation limit (${limit})`,
        subscription: {
          tier,
          active,
          features
        },
        usage: {
          used: usageCount,
          limit
        }
      });
      return;
    }
    
    // Attach subscription info to request
    authenticatedReq.subscription = {
      tier,
      features
    };
    
    next();
  } catch (error) {
    console.error('Error checking subscription limits:', error);
    res.status(500).json({ error: 'Failed to check subscription limits' });
    return;
  }
};

// Handle Stripe webhook events
async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!endpointSecret) {
    console.error('Missing Stripe webhook secret');
    res.status(500).json({ error: 'Missing Stripe webhook secret' });
    return;
  }
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }
  
  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        // Payment was successful, provision access
        console.log('Checkout session completed:', event.data.object);
        break;
        
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        // Subscription was created or updated
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.deleted':
        // Subscription was canceled
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;
        
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error handling webhook event:', err);
    res.status(500).json({ error: 'Error handling webhook event' });
  }
}

// Handle subscription created or updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    // Get customer ID from subscription
    const customerId = typeof subscription.customer === 'string' ? 
      subscription.customer : subscription.customer.id;
    
    // Get customer details from Stripe
    const customer = await stripe.customers.retrieve(customerId);
    
    if ('deleted' in customer && customer.deleted) {
      console.error('Customer has been deleted');
      return;
    }
    
    // Get user ID from customer metadata
    const userId = customer.metadata?.userId;
    
    if (!userId) {
      console.error('No user ID found in customer metadata');
      return;
    }
    
    // Get subscription item
    const subscriptionItem = subscription.items.data[0];
    const priceId = subscriptionItem.price.id;
    
    // Map price ID to subscription tier
    const tier = PRICE_ID_TO_TIER[priceId] || 'free';
    
    // Check subscription status
    const status = subscription.status;
    const active = status === 'active' || status === 'trialing';
    
    // Get current period end
    const currentPeriodEnd = new Date((subscription as Stripe.Subscription & { current_period_end: number }).current_period_end * 1000).toISOString();
    
    // Update or insert subscription in Supabase
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        tier,
        active,
        status,
        expires_at: currentPeriodEnd,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error updating subscription in Supabase:', error);
      return;
    }
    
    console.log('Subscription updated in Supabase:', data);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

// Handle subscription canceled
async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  try {
    // Get subscription ID
    const subscriptionId = subscription.id;
    
    // Find subscription in Supabase
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', subscriptionId)
      .single();
    
    if (error) {
      console.error('Error finding subscription in Supabase:', error);
      return;
    }
    
    if (!data) {
      console.error('No subscription found in Supabase');
      return;
    }
    
    // Update subscription in Supabase
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        active: false,
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscriptionId);
    
    if (updateError) {
      console.error('Error updating subscription in Supabase:', updateError);
      return;
    }
    
    console.log('Subscription canceled in Supabase');
  } catch (error) {
    console.error('Error handling subscription cancellation:', error);
  }
}

// Update usage count
async function updateUsageCount(userId: string, type: 'image' | 'video') {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if there's an existing usage record for today
    const { data, error } = await supabase
      .from('usage')
      .select('*')
      .eq('user_id', userId)
      .eq('type', type)
      .eq('date', today)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
      console.error('Error checking usage:', error);
      return;
    }
    
    if (data) {
      // Update existing record
      const { error: updateError } = await supabase
        .from('usage')
        .update({ count: data.count + 1 })
        .eq('id', data.id);
      
      if (updateError) {
        console.error('Error updating usage count:', updateError);
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabase
        .from('usage')
        .insert({
          user_id: userId,
          type,
          date: today,
          count: 1
        });
      
      if (insertError) {
        console.error('Error inserting usage count:', insertError);
      }
    }
  } catch (error) {
    console.error('Error updating usage count:', error);
  }
}

// Endpoint for generating video from image using Runway
app.post('/api/generate-video-from-image/runway', jsonBodyParser, authenticate, checkSubscriptionLimits, (req: Request, res: Response) => {
  void (async () => {
    try {
      const { imageUrl, prompt, aspectRatio = '16:9' } = req.body;
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      if (!imageUrl) {
        return res.status(400).json({ error: 'No image URL provided' });
      }
      
      // Generate video using our custom Runway API wrapper
      const response = await runwayAPI.generateVideo({
        model: 'gen4_turbo',
        prompt: prompt || '',
        image_url: imageUrl,
        mode: 'image_to_video',
        aspect_ratio: aspectRatio
      });
      
      if (!response || !response.task_id) {
        return res.status(500).json({ error: 'Failed to generate video' });
      }
      
      // Update usage count
      await updateUsageCount(user.id, 'video');
      
      // Return task ID for polling
      return res.json({ taskId: response.task_id });
    } catch (error) {
      console.error('Error generating video from image:', error);
      return res.status(500).json({ error: 'Failed to generate video from image' });
    }
  })();
});

// Endpoint for generating video from text using Runway
app.post('/api/generate-video-from-text/runway', jsonBodyParser, authenticate, checkSubscriptionLimits, (req: Request, res: Response) => {
  void (async () => {
    try {
      const { prompt, aspectRatio = '16:9' } = req.body;
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      if (!prompt) {
        return res.status(400).json({ error: 'No prompt provided' });
      }
      
      // Generate video using our custom Runway API wrapper
      const response = await runwayAPI.generateVideo({
        model: 'gen4_turbo',
        prompt: prompt,
        mode: 'text_to_video',
        aspect_ratio: aspectRatio
      });
      
      if (!response || !response.task_id) {
        return res.status(500).json({ error: 'Failed to generate video' });
      }
      
      // Update usage count
      await updateUsageCount(user.id, 'video');
      
      // Return task ID for polling
      return res.json({ taskId: response.task_id });
    } catch (error) {
      console.error('Error generating video from text:', error);
      return res.status(500).json({ error: 'Failed to generate video from text' });
    }
  })();
});

// Endpoint for checking video generation status
app.get('/api/video-status/:taskId', jsonBodyParser, authenticate, (req: Request, res: Response) => {
  void (async () => {
    try {
      const { taskId } = req.params;
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      if (!taskId) {
        return res.status(400).json({ error: 'No task ID provided' });
      }
      
      // Check status using our custom Runway API wrapper
      try {
        const statusResponse = await runwayAPI.getTaskStatus(taskId);
        
        if (!statusResponse) {
          return res.status(500).json({ error: 'Failed to check video status' });
        }
        
        const status = statusResponse.status;
        let videoUrl: string | null = null;
        
        // If the video is ready, return the URL
        if (status === 'SUCCEEDED' && statusResponse.output) {
          // Extract video URL from output based on the response structure
          videoUrl = Array.isArray(statusResponse.output) ? 
            statusResponse.output[0] : 
            (typeof statusResponse.output === 'string' ? statusResponse.output : null);
          
          // Store the video in S3 and save metadata in Supabase
          if (videoUrl) {
            try {
              // Extract input data safely
              const input = statusResponse.input || {};
              const promptText = input.prompt || '';
              const promptImage = input.image_url || '';
              const mode = input.mode || 'text_to_video';
              const ratio = input.aspect_ratio || '16:9';
              
              // Validate mode type for the function call
              const validMode: 'image_to_video' | 'text_to_video' = 
                (mode === 'image_to_video') ? 'image_to_video' : 'text_to_video';
              
              const videoData = await storeGeneratedVideo(
                user.id,
                videoUrl,
                validMode,
                promptText,
                promptImage ? true : false,
                ratio
              );
              
              // Return the stored video data
              return res.json({
                status,
                videoUrl: videoData.url,
                originalUrl: videoUrl
              });
            } catch (storageError) {
              console.error('Error storing video:', storageError);
              // Fall back to the original URL if storage fails
              return res.json({ status, videoUrl });
            }
          }
        }
        
        // Return the status and video URL (if available)
        return res.json({ status, videoUrl });
      } catch (error) {
        console.error('Error checking video status:', error);
        return res.status(500).json({ error: 'Failed to check video status' });
      }
    } catch (error) {
      console.error('Error checking video status:', error);
      return res.status(500).json({ error: 'Failed to check video status' });
    }
  })();
});

// Endpoint for generating image using Gemini
app.post('/api/generate-image', jsonBodyParser, authenticate, checkSubscriptionLimits, (req: Request, res: Response) => {
  (async () => {
    try {
      const { prompt } = req.body;
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      if (!prompt) {
        return res.status(400).json({ error: 'No prompt provided' });
      }
      
      const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
      const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${geminiApiKey}`;
      
      // Handle Gemini API request for image generation
      const response = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: {
            text: prompt,
          },
          model: 'gemini-pro-vision',
        }),
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to generate image with Gemini' });
      }
      
      const data = await response.json();
      
      // Store images in S3 and save metadata in Supabase
      const storedImages: string[] = [];
      
      if (data.images && data.images.length > 0) {
        // Update usage count
        await updateUsageCount(user.id, 'image');
        
        // Store each image in S3
        for (const imageUrl of data.images) {
          try {
            const imageData = await storeGeneratedImage(user.id, imageUrl as string, prompt);
            storedImages.push(imageData.url as string);
          } catch (storageError) {
            console.error('Error storing image:', storageError);
            // Fall back to the original URL if storage fails
            storedImages.push(imageUrl as string);
          }
        }
      }
      
      return res.json({ images: storedImages || [] });
    } catch (error) {
      console.error('Error generating image:', error);
      return res.status(500).json({ error: 'Failed to generate image' });
    }
  })();
});

// Endpoint for creating a checkout session
app.post('/api/create-checkout-session', jsonBodyParser, authenticate, (req: Request, res: Response) => {
  (async () => {
    try {
      const { priceId } = req.body;
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      if (!priceId) {
        return res.status(400).json({ error: 'No price ID provided' });
      }
      
      // Check if user already has a Stripe customer ID
      const { data: existingCustomer } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single();
      
      let customerId = existingCustomer?.stripe_customer_id;
      
      // Create a new customer if one doesn't exist
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id
          }
        });
        
        customerId = customer.id;
      }
      
      // Create a checkout session
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
        success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/canceled`,
      });
      
      return res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }
  })();
});

// Endpoint for creating a portal session
app.post('/api/create-portal-session', jsonBodyParser, authenticate, (req: Request, res: Response) => {
  (async () => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      // Get user's Stripe customer ID from the most recent active subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .not('stripe_customer_id', 'is', null)
        .order('created_at', { ascending: false });
      
      if (error || !data || data.length === 0 || !data[0]?.stripe_customer_id) {
        return res.status(400).json({ error: 'No subscription found for this user' });
      }
      
      const stripe_customer_id = data[0].stripe_customer_id;
      
      // Create a portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: stripe_customer_id,
        return_url: `${req.headers.origin}/dashboard`,
      });
      
      return res.json({ url: session.url });
    } catch (error) {
      console.error('Error creating portal session:', error);
      return res.status(500).json({ error: 'Failed to create portal session' });
    }
  })();
});

// Webhook endpoint for Stripe
app.post('/api/webhook', rawBodyParser, (req: Request, res: Response) => {
  console.log('⭐ Webhook received with raw body parser:', { 
    headers: req.headers['stripe-signature'],
    hasBody: !!req.body,
    bodyType: typeof req.body,
    isBuffer: Buffer.isBuffer(req.body)
  });
  
  if (!Buffer.isBuffer(req.body)) {
    console.error('Webhook body is not a buffer');
    res.status(400).json({ error: 'Webhook body is not a buffer' });
    return;
  }
  
  // Call the webhook handler asynchronously
  void handleStripeWebhook(req, res);
});

// Get user's subscription
app.get('/api/subscription', jsonBodyParser, authenticate, (req: Request, res: Response) => {
  (async () => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      // Get user's subscription
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        return res.status(400).json({ error: 'Failed to retrieve subscription' });
      }
      
      // Get today's usage
      const today = new Date().toISOString().split('T')[0];
      
      const { data: imageUsage } = await supabase
        .from('usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('type', 'image')
        .eq('date', today)
        .single();
      
      const { data: videoUsage } = await supabase
        .from('usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('type', 'video')
        .eq('date', today)
        .single();
      
      const tier = data.tier as keyof typeof subscriptionFeatures;
      const features = subscriptionFeatures[tier];
      
      return res.json({
        subscription: {
          tier: data.tier,
          active: data.active,
          expiresAt: data.expires_at,
          features
        },
        usage: {
          images: {
            used: imageUsage?.count || 0,
            limit: features.maxImagesPerDay
          },
          videos: {
            used: videoUsage?.count || 0,
            limit: features.maxVideosPerDay
          }
        }
      });
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      return res.status(500).json({ error: 'Failed to retrieve subscription information' });
    }
  })();
});

// Get subscription plans
app.get('/api/subscription-plans', jsonBodyParser, (req: Request, res: Response) => {
  console.log("⭐ Subscription plans requested");
  res.json({
    basic: {
      id: SUBSCRIPTION_PRICES.BASIC,
      productId: SUBSCRIPTION_PRODUCTS.BASIC,
      name: 'Basic',
      price: 9.99,
      features: subscriptionFeatures.basic
    },
    premium: {
      id: SUBSCRIPTION_PRICES.PREMIUM,
      productId: SUBSCRIPTION_PRODUCTS.PREMIUM,
      name: 'Premium',
      price: 19.99,
      features: subscriptionFeatures.premium
    }
  });
});

// Diagnostic endpoint to check Stripe configuration
app.get('/api/stripe-config-check', jsonBodyParser, (req: Request, res: Response) => {
  const stripeConfig = {
    publishableKeyExists: !!process.env.VITE_STRIPE_PUBLISHABLE_KEY,
    secretKeyExists: !!process.env.STRIPE_SECRET_KEY,
    basicPriceIdExists: !!SUBSCRIPTION_PRICES.BASIC,
    basicPriceId: SUBSCRIPTION_PRICES.BASIC,
    premiumPriceIdExists: !!SUBSCRIPTION_PRICES.PREMIUM,
    premiumPriceId: SUBSCRIPTION_PRICES.PREMIUM,
    basicProductIdExists: !!SUBSCRIPTION_PRODUCTS.BASIC,
    premiumProductIdExists: !!SUBSCRIPTION_PRODUCTS.PREMIUM,
    webhookSecretExists: !!process.env.STRIPE_WEBHOOK_SECRET
  };
  
  res.json({
    config: stripeConfig,
    message: 'This endpoint helps diagnose Stripe configuration issues'
  });
});

// Test endpoint for webhook verification
app.post('/api/test-webhook', rawBodyParser, (req: Request, res: Response) => {
  console.log('⭐ Test webhook received');
  console.log('Body type:', typeof req.body);
  console.log('Is Buffer:', Buffer.isBuffer(req.body));
  
  if (Buffer.isBuffer(req.body)) {
    console.log('Buffer length:', req.body.length);
    try {
      const jsonData = JSON.parse(req.body.toString());
      console.log('Parsed data:', jsonData);
      res.status(200).json({ success: true, message: 'Test webhook received successfully', bodyWasBuffer: true });
    } catch (err) {
      console.error('Error parsing buffer:', err);
      res.status(400).json({ success: false, error: 'Could not parse buffer', bodyWasBuffer: true });
    }
  } else {
    console.log('Non-buffer data:', req.body);
    res.status(200).json({ success: true, message: 'Test webhook received, but body was not a buffer', bodyWasBuffer: false });
  }
});

// Endpoint for retrieving user's generated videos
app.get('/api/user/videos', jsonBodyParser, authenticate, (req: Request, res: Response) => {
  (async () => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      // Get all videos generated by the user
      const videos = await getUserVideos(user.id);
      
      return res.json({ videos });
    } catch (error) {
      console.error('Error retrieving user videos:', error);
      return res.status(500).json({ error: 'Failed to retrieve user videos' });
    }
  })();
});

// Endpoint for retrieving user's generated images
app.get('/api/user/images', jsonBodyParser, authenticate, (req: Request, res: Response) => {
  (async () => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      // Get all images generated by the user
      const images = await getUserImages(user.id);
      
      return res.json({ images });
    } catch (error) {
      console.error('Error retrieving user images:', error);
      return res.status(500).json({ error: 'Failed to retrieve user images' });
    }
  })();
});

// Endpoint for retrieving all user's generated content (both images and videos)
app.get('/api/user/content', jsonBodyParser, authenticate, (req: Request, res: Response) => {
  (async () => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      // Get all content generated by the user
      const [videos, images] = await Promise.all([
        getUserVideos(user.id),
        getUserImages(user.id)
      ]);
      
      res.json({ videos, images });
    } catch (error) {
      console.error('Error retrieving user content:', error);
      res.status(500).json({ error: 'Failed to retrieve user content' });
    }
  })();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook`);
  console.log(`Test webhook endpoint: http://localhost:${PORT}/api/test-webhook`);
});
