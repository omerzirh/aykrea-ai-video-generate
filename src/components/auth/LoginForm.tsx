import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../lib/auth-context';
import { useLanguageHook as useLanguage } from '../../lib/use-language';

interface LoginFormProps {
  onSuccess: () => void;
  onForgotPassword: () => void;
}

export default function LoginForm({ onSuccess, onForgotPassword }: LoginFormProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, isLoading: authLoading } = useAuth();
  
  // Effect to handle successful authentication
  useEffect(() => {
    console.log('LoginForm: useEffect triggered');
    console.log('LoginForm: user:', user, 'authLoading:', authLoading, 'isLoading:', isLoading);
    // If we have a user and we're not in a loading state, call onSuccess
    if (user && isLoading) {
      console.log("LoginForm: User authenticated, calling onSuccess");
      setIsLoading(false); // Reset loading state
      onSuccess(); // Close the modal
    }
  }, [user, authLoading, onSuccess, isLoading]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('LoginForm: Attempting to sign in with email:', email);
      await signIn(email, password);
      // Don't call onSuccess here - let the useEffect handle it
      // This prevents race conditions where signIn completes but the auth context hasn't updated yet
    } catch (error) {
      console.error("LoginForm: signIn failed:", error);
      setIsLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input
          id="email"
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Button
            type="button"
            variant="link"
            className="px-0 text-xs"
            onClick={onForgotPassword}
          >
            {t('auth.forgotPassword')}
          </Button>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? 'Logging in...' : t('auth.signIn')}
      </Button>
    </form>
  );
}