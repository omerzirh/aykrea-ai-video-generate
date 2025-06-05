import { useAuth } from '../../lib/auth-context';
import { useLanguageHook as useLanguage } from '../../lib/use-language';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { redirectToCustomerPortal } from '../../lib/stripe';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface UsageStats {
  images: {
    used: number;
    limit: number;
  };
  videos: {
    used: number;
    limit: number;
  };
}

export default function UserDashboard() {
  const { user, subscription, signOut } = useAuth();
  const { t } = useLanguage();
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUsageStats = useCallback(async () => {
    if (!user || !subscription) return;

    try {
      setIsLoading(true);
      
      // Get today's date in ISO format (YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];
      
      // Get image usage
      const { data: imageData } = await supabase
        .from('usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('type', 'image')
        .eq('date', today)
        .single();
      
      // Get video usage
      const { data: videoData } = await supabase
        .from('usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('type', 'video')
        .eq('date', today)
        .single();
      
      setUsageStats({
        images: {
          used: imageData?.count || 0,
          limit: subscription.features.maxImagesPerDay
        },
        videos: {
          used: videoData?.count || 0,
          limit: subscription.features.maxVideosPerDay
        }
      });
    } catch (error) {
      console.error('Error fetching usage stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, subscription]);

  useEffect(() => {
    if (user && subscription) {
      fetchUsageStats();
    } else {
      setIsLoading(false);
    }
  }, [user, subscription, fetchUsageStats]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="outline" onClick={signOut}>{t('header.signOut')}</Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('subscription.currentPlan')}</CardTitle>
            <CardDescription>{t('dashboard.currentPlan')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold capitalize">
                {subscription?.tier ? t(`subscription.${subscription.tier}`) : t('subscription.free')}
              </span>
              {subscription?.tier !== 'free' && (
                <span className="text-muted-foreground">
                  {subscription?.expiresAt 
                    ? `${t('subscription.expiresOn')} ${new Date(subscription.expiresAt).toLocaleDateString()}`
                    : t('subscription.active')}
                </span>
              )}
            </div>
            <div className="mt-4 space-y-2">
              {subscription?.tier !== 'free' ? (
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={async () => {
                    try {
                      const { error } = await redirectToCustomerPortal();
                      if (error) {
                        toast.error(error);
                      }
                    } catch (error: unknown) {
                      console.error('Error redirecting to portal:', error);
                      toast.error(t('subscription.managementError'));
                    }
                  }}
                >
                  {t('dashboard.managePlan')}
                </Button>
              ) : null}
              <Button 
                variant={subscription?.tier !== 'free' ? "secondary" : "outline"} 
                className="w-full" 
                onClick={() => navigate('/plans')}
              >
                {subscription?.tier === 'free' ? t('subscription.upgrade') : t('subscription.changePlan')}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.usageStats')}</CardTitle>
            <CardDescription>{t('dashboard.dailyReset')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-center py-4">{t('dashboard.loadingUsage')}</div>
            ) : usageStats ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>{t('content.images')}</span>
                    <span className="text-sm text-muted-foreground">
                      {usageStats.images.used} / {usageStats.images.limit}
                    </span>
                  </div>
                  <Progress value={(usageStats.images.used / usageStats.images.limit) * 100} />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>{t('content.videos')}</span>
                    <span className="text-sm text-muted-foreground">
                      {usageStats.videos.used} / {usageStats.videos.limit}
                    </span>
                  </div>
                  <Progress value={(usageStats.videos.used / usageStats.videos.limit) * 100} />
                </div>
              </>
            ) : (
              <div className="text-center py-4">{t('dashboard.noUsageData')}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
