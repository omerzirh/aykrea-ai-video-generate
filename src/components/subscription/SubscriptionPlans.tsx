import { useState, useEffect } from 'react';
import { useLanguageHook as useLanguage } from '../../lib/use-language';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { useAuth } from '../../lib/auth-context';
import { SubscriptionTier, subscriptionFeatures } from '../../lib/supabase';
import { Check } from 'lucide-react';
import { redirectToCheckout, fetchSubscriptionPlans } from '../../lib/stripe';
import { validateStripeEnvironment, displayEnvironmentWarning } from '../../lib/check-environment';
import toast from 'react-hot-toast';

interface PlanInfo {
  id: string;
  name: string;
  price: number;
  features: typeof subscriptionFeatures.basic;
}

interface SubscriptionPlans {
  basic: PlanInfo;
  premium: PlanInfo;
}

export default function SubscriptionPlans() {
  const { subscription, user } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState<SubscriptionTier | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlans | null>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [environmentValid, setEnvironmentValid] = useState(true);
  
  // Check environment variables
  useEffect(() => {
    const envCheck = validateStripeEnvironment();
    if (!envCheck.valid) {
      setErrorMessage(envCheck.message);
      setEnvironmentValid(false);
      displayEnvironmentWarning();
    }
  }, []);
  
  // Fetch subscription plans from the server
  useEffect(() => {
    const getPlans = async () => {
      try {
        setIsLoadingPlans(true);
        setErrorMessage(null);
        const plansData = await fetchSubscriptionPlans();
        setPlans(plansData);
      } catch (error) {
        console.error('Error fetching plans:', error);
        toast.error('Failed to load subscription plans');
        setErrorMessage('Failed to load subscription plans. Please refresh the page.');
      } finally {
        setIsLoadingPlans(false);
      }
    };
    
    if (environmentValid) {
      getPlans();
    }
  }, [environmentValid]);

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!environmentValid) {
      toast.error('Cannot subscribe: Stripe environment is not properly configured');
      return;
    }
    
    if (!user) {
      toast.error('You must be logged in to subscribe');
      return;
    }
    
    if (tier === 'free') {
      // Free tier doesn't need Stripe checkout
      return;
    }
    
    setIsLoading(tier);
    setErrorMessage(null);
    
    try {
      // Check if the server is running
      try {
        const serverCheck = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subscription-plans`, { 
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Server check response:', {
          status: serverCheck.status,
          ok: serverCheck.ok
        });
        
        if (!serverCheck.ok) {
          throw new Error(`Server returned status ${serverCheck.status}`);
        }
      } catch (serverCheckError) {
        console.error('Server check failed:', serverCheckError);
        toast.error('Server connection failed. Please ensure the server is running.');
        setErrorMessage('Server connection failed. Please ensure the server is running at http://localhost:3001');
        setIsLoading(null);
        return;
      }
      
      // Get the price ID for the selected tier
      const priceId = plans?.[tier]?.id;
      
      if (!priceId) {
        throw new Error(`No price ID found for ${tier} tier`);
      }
      
      console.log(`Subscribing to ${tier} plan with price ID: ${priceId}`);
      
      // Redirect to Stripe checkout
      const { error } = await redirectToCheckout(priceId);
      
      if (error) {
        throw new Error(error);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process subscription';
      console.error('Error subscribing:', error);
      toast.error(errorMessage);
      setErrorMessage(errorMessage + '. ' + t('subscription.tryAgain'));
    } finally {
      setIsLoading(null);
    }
  };

  // Combine local and server data for plans
  const displayPlans = [
    {
      tier: 'free' as SubscriptionTier,
      name: t('subscription.free'),
      price: '$0',
      description: t('subscription.freeDescription') || 'Basic access for occasional use',
      features: [
        `${subscriptionFeatures.free.maxImagesPerDay} ${t('dashboard.imagesPerDay')}`,
        `${subscriptionFeatures.free.maxVideosPerDay} ${t('dashboard.videosPerDay')}`,
        `${subscriptionFeatures.free.maxVideoLength} ${t('dashboard.secondVideos')}`,
        t('dashboard.standardQuality')
      ]
    },
    {
      tier: 'basic' as SubscriptionTier,
      name: plans?.basic?.name || t('subscription.basic'),
      price: plans?.basic ? `$${plans.basic.price}` : '$9.99',
      description: t('subscription.basicDescription') || 'Perfect for regular creators',
      features: [
        `${subscriptionFeatures.basic.maxImagesPerDay} ${t('dashboard.imagesPerDay')}`,
        `${subscriptionFeatures.basic.maxVideosPerDay} ${t('dashboard.videosPerDay')}`,
        `${subscriptionFeatures.basic.maxVideoLength} ${t('dashboard.secondVideos')}`,
        t('dashboard.standardQuality')
      ]
    },
    {
      tier: 'premium' as SubscriptionTier,
      name: plans?.premium?.name || t('subscription.premium'),
      price: plans?.premium ? `$${plans.premium.price}` : '$19.99',
      description: t('subscription.premiumDescription') || 'For professional content creators',
      features: [
        `${subscriptionFeatures.premium.maxImagesPerDay} ${t('dashboard.imagesPerDay')}`,
        `${subscriptionFeatures.premium.maxVideosPerDay} ${t('dashboard.videosPerDay')}`,
        `${subscriptionFeatures.premium.maxVideoLength} ${t('dashboard.secondVideos')}`,
        t('dashboard.highQuality')
      ]
    }
  ];

  if (isLoadingPlans && environmentValid) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{t('subscription.plans')}</h2>
          <p className="text-muted-foreground">{t('subscription.loadingPlans')}</p>
        </div>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">{t('subscription.plans')}</h2>
        <p className="text-muted-foreground">{t('subscription.chooseAPlan')}</p>
        
        {errorMessage && (
          <div className="mt-4 p-4 bg-red-100 text-red-800 rounded-md">
            <p>{errorMessage}</p>
            {!environmentValid && (
              <p className="mt-2 text-sm">
                Add <code>VITE_STRIPE_PUBLISHABLE_KEY</code> to your <code>.env</code> file.
                You can find this key in your Stripe Dashboard.
              </p>
            )}
          </div>
        )}
      </div>
      
      <div className="grid gap-6 md:grid-cols-3">
        {displayPlans.map((plan) => (
          <Card key={plan.tier} className={
            subscription?.tier === plan.tier 
              ? 'border-primary shadow-md' 
              : ''
          }>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                {plan.tier !== 'free' && <span className="text-muted-foreground">{t('subscription.perMonth')}</span>}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                variant={subscription?.tier === plan.tier ? "outline" : "default"}
                disabled={isLoading !== null || subscription?.tier === plan.tier || !environmentValid}
                onClick={() => handleSubscribe(plan.tier)}
              >
                {isLoading === plan.tier ? t('subscription.processing') : 
                  subscription?.tier === plan.tier ? t('subscription.currentPlan') : 
                  !environmentValid ? t('subscription.setupRequired') : t('subscription.subscribe')}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
