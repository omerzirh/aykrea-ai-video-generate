import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import RunwayML from '@runwayml/sdk';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import bodyParser from 'body-parser';
import { 
  SUBSCRIPTION_PRICES, 
  SUBSCRIPTION_PRODUCTS, 
  subscriptionFeatures, 
  SubscriptionTier, 
  PRICE_ID_TO_TIER
} from './utils/stripe';
import { storeGeneratedVideo, getUserVideos } from './utils/video-storage';
import { storeGeneratedImage, getUserImages } from './utils/image-storage';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Initialize Runway
const runwayApiKey = process.env.VITE_RUNWAY_API_KEY;
const runway = new RunwayML(runwayApiKey);

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
const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Attach user to request
    (req as AuthenticatedRequest).user = user;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

// Check subscription limits middleware
const checkSubscriptionLimits = async (req: Request, res: Response, next: NextFunction) => {
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
      return res.status(400).json({ error: 'Failed to retrieve subscription' });
    }
    
    // Default to free tier if no subscription found
    const tier = (data?.tier as SubscriptionTier) || 'free';
    const active = data?.active !== false; // Default to true if not explicitly false
    
    // Get subscription features
    const features = subscriptionFeatures[tier];
    
    // Check if subscription is active
    if (!active && tier !== 'free') {
      return res.status(403).json({ 
        error: 'Your subscription is inactive',
        subscription: {
          tier,
          active,
          features
        }
      });
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
      return res.status(403).json({ 
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
    }
    
    // Attach subscription info to request
    authenticatedReq.subscription = {
      tier,
      features
    };
    
    next();
  } catch (error) {
    console.error('Error checking subscription limits:', error);
    return res.status(500).json({ error: 'Failed to check subscription limits' });
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
async function handleSubscriptionUpdated(subscription: any) {
  try {
    // Get customer ID from subscription
    const customerId = subscription.customer;
    
    // Get customer details from Stripe
    const customer = await stripe.customers.retrieve(customerId);
    
    if (customer.deleted) {
      console.error('Customer has been deleted');
      return;
    }
    
    // Get user ID from customer metadata
    const userId = customer.metadata.userId;
    
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
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    
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
async function handleSubscriptionCanceled(subscription: any) {
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
  (async () => {
    try {
      const { imageUrl, prompt, aspectRatio = '16:9' } = req.body;
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      if (!imageUrl) {
        return res.status(400).json({ error: 'No image URL provided' });
      }
      
      // Generate video using Runway
      const response = await runway.generateVideo({
        prompt: prompt || '',
        image_url: imageUrl,
        aspect_ratio: aspectRatio,
        mode: 'image_to_video',
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
  (async () => {
    try {
      const { prompt, aspectRatio = '16:9' } = req.body;
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      if (!prompt) {
        return res.status(400).json({ error: 'No prompt provided' });
      }
      
      // Generate video using Runway
      const response = await runway.generateVideo({
        prompt,
        aspect_ratio: aspectRatio,
        mode: 'text_to_video',
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
  (async () => {
    try {
      const { taskId } = req.params;
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      if (!taskId) {
        return res.status(400).json({ error: 'No task ID provided' });
      }
      
      // Check status using Runway
      const statusResponse = await runway.getTaskStatus(taskId);
      
      if (!statusResponse) {
        return res.status(500).json({ error: 'Failed to check video status' });
      }
      
      const status = statusResponse.status;
      let videoUrl = null;
      
      // If the video is ready, return the URL
      if (status === 'SUCCEEDED' && Array.isArray(statusResponse.output)) {
        videoUrl = statusResponse.output[0] || null;
        
        // Store the video in S3 and save metadata in Supabase
        if (videoUrl) {
          try {
            const videoData = await storeGeneratedVideo(
              user.id,
              videoUrl,
              statusResponse.input?.prompt || '',
              statusResponse.input?.image_url || null,
              statusResponse.input?.mode || 'text_to_video',
              statusResponse.input?.aspect_ratio || '16:9'
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
      const storedImages = [];
      
      if (data.images && data.images.length > 0) {
        // Update usage count
        await updateUsageCount(user.id, 'image');
        
        // Store each image in S3
        for (const imageUrl of data.images) {
          try {
            const imageData = await storeGeneratedImage(user.id, imageUrl, prompt);
            storedImages.push(imageData.url);
          } catch (storageError) {
            console.error('Error storing image:', storageError);
            // Fall back to the original URL if storage fails
            storedImages.push(imageUrl);
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
      const { data: existingCustomer, error: customerError } = await supabase
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
      
      // Get user's Stripe customer ID
      const { data, error } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single();
      
      if (error || !data?.stripe_customer_id) {
        return res.status(400).json({ error: 'No subscription found for this user' });
      }
      
      // Create a portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: data.stripe_customer_id,
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
    return res.status(400).json({ error: 'Webhook body is not a buffer' });
  }
  
  handleStripeWebhook(req, res);
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
  console.log("⭐ Subscription plans fixed");

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
      
      return res.json({ videos, images });
    } catch (error) {
      console.error('Error retrieving user content:', error);
      return res.status(500).json({ error: 'Failed to retrieve user content' });
    }
  })();
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook`);
  console.log(`Test webhook endpoint: http://localhost:${PORT}/api/test-webhook`);
});
