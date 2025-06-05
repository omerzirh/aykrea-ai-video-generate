import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useAuth } from '../../lib/auth-context';
import { CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';

export default function CheckoutSuccess() {
  const { user, subscription, fetchUserSubscription } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const fetchAttemptRef = useRef(0);
  const hasCompletedFetchRef = useRef(false);
  const navigate = useNavigate();
  
  // Get the session_id from URL if available
  const location = useLocation();
  const sessionId = new URLSearchParams(location.hash.includes('?') 
    ? location.hash.substring(location.hash.indexOf('?')) 
    : location.search).get('session_id');
  console.log("successo", {sessionId})
  useEffect(() => {
    // Only run this effect once
    if (hasCompletedFetchRef.current) {
      return;
    }

    console.log('🔄 CheckoutSuccess component mounted', { 
      sessionId, 
      userId: user?.id,
      currentSubscription: subscription?.tier,
      hasCompleted: hasCompletedFetchRef.current
    });
    
    // Skip if we already have a paid subscription
    if (subscription && subscription.tier !== 'free') {
      console.log('✅ Subscription already available:', subscription.tier);
      setIsLoading(false);
      hasCompletedFetchRef.current = true;
      return;
    }
    
    const fetchSubscriptionData = async () => {
      if (!user) {
        console.log('❌ No user found, cannot fetch subscription');
        setIsLoading(false);
        hasCompletedFetchRef.current = true;
        return;
      }
      
      // Don't proceed if we've already completed the fetch
      if (hasCompletedFetchRef.current) {
        return;
      }
      
      console.log('🔍 Attempting to fetch subscription data for user:', user.id);
      
      try {
        // Get the current session token
        const sessionResponse = await supabase.auth.getSession();
        const token = sessionResponse.data.session?.access_token;
        
        if (!token) {
          console.error('❌ No auth token available');
          throw new Error('No auth token available');
        }
        
        console.log('✅ Auth token obtained, fetching subscription data');
        
        // Fetch the latest subscription data from the server
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/subscription`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          console.error('❌ Failed to fetch subscription data, status:', response.status);
          throw new Error(`Failed to fetch subscription data: ${response.status}`);
        }
        
        const subscriptionData = await response.json();
        console.log('✅ Received subscription data from server:', subscriptionData);
        setDebugInfo(subscriptionData);
        
        // Update the subscription in the auth context
        if (fetchUserSubscription && typeof fetchUserSubscription === 'function') {
          console.log('🔄 Updating subscription in auth context');
          await fetchUserSubscription(user.id);
          console.log('✅ Subscription updated in auth context, new tier:', subscription?.tier);
        } else {
          console.error('❌ fetchUserSubscription function not available');
        }
        
        // Mark as completed and stop loading
        hasCompletedFetchRef.current = true;
        setIsLoading(false);
      } catch (error) {
        console.error('❌ Error fetching subscription:', error);
        
        // If we haven't tried too many times, retry
        const currentAttempt = fetchAttemptRef.current;
        if (currentAttempt < 3) { // Limit to 3 retry attempts
          fetchAttemptRef.current = currentAttempt + 1;
          const delay = (currentAttempt + 1) * 1000; // Increase delay with each attempt
          console.log(`🔄 Retry attempt ${currentAttempt + 1}/3 in ${delay/1000} seconds...`);
          
          // Wait longer before retrying with each attempt
          setTimeout(() => fetchSubscriptionData(), delay);
        } else {
          console.error('❌ Max retry attempts reached');
          hasCompletedFetchRef.current = true;
          setIsLoading(false);
        }
      }
    };
    
    fetchSubscriptionData();
    
    return () => {
      console.log('🔄 CheckoutSuccess component unmounting');
    };
  }, [user, subscription, fetchUserSubscription, sessionId]);
  // We include these dependencies but use the ref to prevent re-execution
  
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Subscription Successful!</CardTitle>
          <CardDescription>
            Thank you for subscribing to our service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p>Updating your subscription... (Attempt {fetchAttemptRef.current + 1})</p>
              {fetchAttemptRef.current > 2 && (
                <p className="text-sm text-amber-600 mt-2">
                  This is taking longer than expected. Please be patient...
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="text-center">
                <p className="font-medium">
                  Your {subscription?.tier} plan is now active
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  You now have access to all the features included in your plan.
                </p>
                {debugInfo && import.meta.env.DEV && (
                  <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-left overflow-auto max-h-32">
                    <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                  </div>
                )}
              </div>
              <div className="flex justify-center pt-2">
                <Button onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
