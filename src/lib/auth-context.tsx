import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, UserSubscription, SubscriptionTier, subscriptionFeatures } from './supabase';
import { PostgrestError } from '@supabase/supabase-js';

// interface SubscriptionQueryResult {
//   data: UserSubscription[] | null;
//   error: PostgrestError | null;
// }
import { Session, User } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import LoadingPage from '../components/ui/LoadingPage';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  subscription: UserSubscription | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ user: User; session: Session; } | void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateSubscription: (tier: SubscriptionTier) => Promise<void>;
  checkUsageLimit: (type: 'image' | 'video') => Promise<boolean>;
  incrementUsage: (type: 'image' | 'video') => Promise<void>;
  fetchUserSubscription: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up the auth state listener immediately
    const authStateListener = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("Auth state changed. Event:", event, "New session:", newSession);
        
        // Update session and user state
        setSession(newSession);
        const newUser = newSession?.user ?? null;
        setUser(newUser);
        console.log("Setting user to:", newUser);
        
        // Update subscription state
        if (newUser?.id) {
          console.log('Fetching subscription for user:', newUser.id);
          await fetchUserSubscription(newUser.id);
        } else {
          console.log('No user ID, clearing subscription');
          setSubscription(null);
        }
        
        // Only set loading to false after all state updates are complete
        setIsLoading(false);
      }
    );

    // Initially fetch the session once
    (async () => {
      try {
        setIsLoading(true); // Ensure loading state is set
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user ?? null);
          
          if (currentSession.user) {
            await fetchUserSubscription(currentSession.user.id);
          }
        } else {
          // Clear subscription if no session
          setSubscription(null);
        }
      } catch (e) {
        console.error("Error fetching initial session:", e);
        toast.error('Failed to load authentication state');
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      authStateListener.data.subscription.unsubscribe();
    };
  }, []);

  // Fetch user's subscription details
  const fetchUserSubscription = async (userId: string): Promise<void> => {
    console.log('Starting subscription fetch for user:', userId);
    try {
      console.log('Querying subscriptions table...');
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 1000)
      );

      const queryPromise = supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      const result = await Promise.race([queryPromise, timeoutPromise]);
      console.log('Query result:', result);
      
      if (!result) {
        throw new Error('No result from query');
      }

      const { data, error } = result as { data: UserSubscription[] | null, error: PostgrestError | null };
      
      if (error) {
        // Check if it's a 404 error (no subscription found)
        if (error.code === 'PGRST116') {
          console.log('No subscription found for user');
          setSubscription(null);
          return;
        }
        console.error('Error fetching subscription:', error);
        setSubscription(null);
        return;
      }

      if (!data) {
        console.log('No data returned from subscription query');
        setSubscription(null);
        return;
      }
      
      if (!data || data.length === 0) {
        // If no subscription found, create a free tier subscription
        const newSubscription: UserSubscription = {
          tier: 'free',
          active: true,
          expiresAt: null,
          features: subscriptionFeatures.free
        };
        
        // Insert the new subscription
        await supabase
          .from('subscriptions')
          .insert({
            user_id: userId,
            tier: 'free',
            active: true,
            expires_at: null
          });
        
        setSubscription(newSubscription);
      } else {
        // Map database subscription to our UserSubscription type
        const latestSubscription = data[0];
        const userSubscription: UserSubscription = {
          tier: latestSubscription.tier as SubscriptionTier,
          active: latestSubscription.active,
          expiresAt: latestSubscription.expiresAt, // Using the correct property name
          features: subscriptionFeatures[latestSubscription.tier as SubscriptionTier]
        };
        
        setSubscription(userSubscription);
      }
    } catch (error: unknown) {
      console.error('Error in fetchUserSubscription:', error);
      // toast.error('Failed to load subscription details');
    }
  };

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true); // Set loading to true at start of sign in process
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('Sign in data:', data, 'Error:', error);
      if (error) {
        throw error;
      }
      
      toast.success('Signed in successfully');
      return data;
    } catch (error: unknown) {
      console.error('Error signing in:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sign in');
      throw error;
    } finally {
      // Don't set isLoading to false here - let the auth state change handler do it
      // This ensures we correctly reflect the current auth state
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      toast.success('Signed up successfully! Please check your email for verification.');
    } catch (error: unknown) {
      console.error('Error signing up:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sign up');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      console.log('Signing out...');
      console.log('User:', supabase.auth);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Signed out successfully');
    } catch (error: unknown) {
      console.error('Error signing out:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to sign out');
    }
    // Don't set isLoading to false here - let the auth state change handler do it
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      toast.success('Password reset email sent');
    } catch (error: unknown) {
      console.error('Error resetting password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send reset email');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update subscription tier
  const updateSubscription = async (tier: SubscriptionTier) => {
    if (!user) {
      toast.error('You must be logged in to update your subscription');
      return;
    }

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          tier,
          active: true,
          features: JSON.stringify(subscriptionFeatures[tier])
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Update local subscription state
      setSubscription({
        tier,
        active: true,
        expiresAt: null,
        features: subscriptionFeatures[tier]
      });
      
      toast.success(`Subscription updated to ${tier} plan`);
    } catch (error: unknown) {
      console.error('Error updating subscription:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update subscription');
    }
  };

  // Check if user has reached their usage limit
  const checkUsageLimit = async (type: 'image' | 'video'): Promise<boolean> => {
    if (!user || !subscription) return false;

    try {
      // Get today's date in ISO format (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];
      
      // Get usage count for today
      const { data, error } = await supabase
        .from('usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('type', type)
        .eq('date', today)
        .limit(1);

      if (error) {
        console.error('Error checking usage limit:', error);
        return true; // Allow operation on error to prevent blocking users
      }

      const currentCount = data && data.length > 0 ? data[0].count : 0;
      const limit = type === 'image' 
        ? subscription.features.maxImagesPerDay 
        : subscription.features.maxVideosPerDay;

      return currentCount < limit;
    } catch (error: unknown) {
      console.error('Error in checkUsageLimit:', error);
      return true; // Allow operation on error to prevent blocking users
    }
  };

  // Increment usage count
  const incrementUsage = async (type: 'image' | 'video'): Promise<void> => {
    if (!user) return;

    try {
      // Get today's date in ISO format (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];
      
      // Check if entry exists for today
      const { data, error } = await supabase
        .from('usage')
        .select('id, count')
        .eq('user_id', user.id)
        .eq('type', type)
        .eq('date', today)
        .limit(1);

      if (error) {
        console.error('Error incrementing usage:', error);
        return;
      }

      if (data && data.length > 0) {
        // Update existing entry
        await supabase
          .from('usage')
          .update({ count: data[0].count + 1 })
          .eq('id', data[0].id);
      } else {
        // Create new entry
        await supabase
          .from('usage')
          .insert({
            user_id: user.id,
            type,
            date: today,
            count: 1
          });
      }
    } catch (error: unknown) {
      console.error('Error in incrementUsage:', error);
    }
  };

  // Using these values directly in the provider below

  return (
    <AuthContext.Provider 
      value={{ 
        session, 
        user, 
        subscription, 
        isLoading, 
        signIn, 
        signUp, 
        signOut, 
        resetPassword, 
        updateSubscription, 
        checkUsageLimit, 
        incrementUsage, 
        fetchUserSubscription 
      }}
    >
      {isLoading ? <LoadingPage /> : children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};