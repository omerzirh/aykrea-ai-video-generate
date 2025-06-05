import { loadStripe } from '@stripe/stripe-js';
import { supabase } from './supabase';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Create a checkout session and redirect to Stripe
export const redirectToCheckout = async (priceId: string): Promise<{ error?: string }> => {
  try {
    // First check if Stripe is properly initialized
    const stripeInstance = await stripePromise;
    console.log(stripeInstance);
    if (!stripeInstance) {
      console.error('Stripe failed to initialize');
      return { error: 'Stripe payment system failed to initialize. Check your API keys.' };
    }
    
    const { data, error: sessionError } = await supabase.auth.getSession();
    console.log("sessionError", sessionError);
    console.log("data", data);
    
    // Get the current session from Supabase
    
    // Extract session from data
    if (!data) {
      console.error('No active Supabase session found.');
      return { error: 'You must be logged in to subscribe' };
    }
    
    console.log('Making request to create checkout session...', {
      priceId,
      sessionExists: !!data,
      accessTokenExists: !!data?.session?.user?.id,
    });
    
    // First check the Stripe configuration
    try {
      const configCheck = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/stripe-config-check`);
      const configData = await configCheck.json();
      console.log('Stripe config check:', configData);
      
      if (!configData.config.basicPriceIdExists || !configData.config.secretKeyExists) {
        return { error: 'Stripe is not properly configured on the server. Check environment variables.' };
      }
    } catch (configError) {
      console.error('Failed to check Stripe configuration:', configError);
      // Continue anyway
    }
    
    // Make sure the server URL uses the correct protocol
    const serverUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001/api/create-checkout-session'
      : '/api/create-checkout-session';
      
    console.log('Request URL:', serverUrl);
    console.log('Request payload:', JSON.stringify({ priceId }));
    
    try {
      // Set up the request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.session?.access_token}`
        },
        body: JSON.stringify({ priceId }),
        mode: 'cors',
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        
        // Fallback to direct Stripe checkout if server returns an error
        if (response.status === 500) {
          console.log('Attempting direct Stripe checkout as fallback...');
          const { error: stripeError } = await stripeInstance.redirectToCheckout({
            lineItems: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/canceled`,
          });
          
          if (stripeError) {
            throw new Error(stripeError.message);
          }
          return {};
        }
        
        return { error: `Server error: ${response.status} ${errorText}` };
      }

      const responseData = await response.json();
      console.log('Response data:', responseData);
      const { url, errorResponse } = responseData;
      
      if (errorResponse) {
        console.error('Error in response:', errorResponse);
        return { error: errorResponse };
      }
      
      if (!url) {
        console.error('No URL returned from server');
        return { error: 'No checkout URL returned from server' };
      }
      
      // Redirect to Stripe Checkout
      console.log('Redirecting to:', url);
      window.location.assign(url);
      
      return {};
    } catch (fetchError: any) {
      console.error('Fetch error during checkout:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        return { error: 'Request timed out. The server took too long to respond.' };
      }
      
      // Try direct Stripe checkout as a fallback
      try {
        console.log('Attempting direct Stripe checkout after fetch error...');
        const { error: stripeError } = await stripeInstance.redirectToCheckout({
          lineItems: [{ price: priceId, quantity: 1 }],
          mode: 'subscription',
          successUrl: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/canceled`,
        });
        
        if (stripeError) {
          throw new Error(stripeError.message);
        }
        return {};
      } catch (stripeCheckoutError) {
        console.error('Direct Stripe checkout failed:', stripeCheckoutError);
        return { 
          error: `Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error during API call'}. 
                 Direct Stripe checkout also failed: ${stripeCheckoutError instanceof Error ? stripeCheckoutError.message : 'Unknown Stripe error'}` 
        };
      }
    }
  } catch (error) {
    console.error('Exception during checkout redirect:', error);
    return { error: error instanceof Error ? error.message : 'Failed to redirect to checkout' };
  }
};

// Redirect to customer portal for subscription management
export const redirectToCustomerPortal = async (): Promise<{ error?: string }> => {
  try {
    // Get the current session from Supabase
    const { data, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting Supabase session for portal:', sessionError);
      return { error: `Failed to get session: ${sessionError.message}` };
    }
    
    const session = data?.session;
    
    if (!session) {
      console.error('No active Supabase session found for portal.');
      return { error: 'You must be logged in to access the customer portal' };
    }
    
    // Make sure the server URL uses the correct protocol
    const serverUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001/api/create-portal-session'
      : '/api/create-portal-session';
      
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Portal server error response:', errorText);
      return { error: `Server error: ${response.status} ${errorText}` };
    }

    const responseData = await response.json();
    const { url, error } = responseData;
    
    if (error) {
      console.error('Error in portal response:', error);
      return { error };
    }
    
    if (!url) {
      console.error('No URL returned from portal server');
      return { error: 'No portal URL returned from server' };
    }
    
    // Redirect to Stripe Customer Portal
    window.location.assign(url);
    return {};
  } catch (error) {
    console.error('Error redirecting to customer portal:', error);
    return { error: error instanceof Error ? error.message : 'Failed to redirect to customer portal' };
  }
};

// Fetch subscription plans
export const fetchSubscriptionPlans = async () => {
  try {
    // Make sure the server URL uses the correct protocol
    const serverUrl = `${import.meta.env.VITE_BACKEND_URL}/api/subscription-plans`;
      
    const response = await fetch(serverUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error fetching subscription plans:', errorText);
      throw new Error(`Server error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Exception during subscription plans fetch:', error);
    throw error;
  }
};