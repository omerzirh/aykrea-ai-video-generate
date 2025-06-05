import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useLanguageHook as useLanguage } from '../../lib/use-language';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import ResetPasswordForm from './ResetPasswordForm';

type AuthMode = 'login' | 'signup' | 'reset-password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: AuthMode;
}

export default function AuthModal({ 
  isOpen, 
  onClose, 
  defaultMode = 'login' 
}: AuthModalProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  
  // Handler for successful authentication
  const handleSuccess = () => {
    console.log("Auth successful, closing modal");
    onClose();
  };
  
  // Handlers for switching between auth modes
  const showLogin = () => setMode('login');
  const showSignup = () => setMode('signup');
  const showResetPassword = () => setMode('reset-password');
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'login' && t('auth.signIn')}
            {mode === 'signup' && t('auth.signUp')}
            {mode === 'reset-password' && t('auth.resetPassword')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {mode === 'login' && (
            <LoginForm
              onSuccess={handleSuccess}
              onForgotPassword={showResetPassword}
            />
          )}
          
          {mode === 'signup' && (
            <SignupForm
              onSuccess={handleSuccess}
              onLogin={showLogin}
            />
          )}
          
          {mode === 'reset-password' && (
            <ResetPasswordForm
              onBack={showLogin}
            />
          )}
        </div>
        
        {mode === 'login' && (
          <div className="text-center text-sm">
            {t('auth.noAccount')}{' '}
            <button
              type="button"
              onClick={showSignup}
              className="text-primary hover:underline"
            >
              {t('auth.signUp')}
            </button>
          </div>
        )}
        
        {mode === 'signup' && (
          <div className="text-center text-sm">
            {t('auth.haveAccount')}{' '}
            <button
              type="button"
              onClick={showLogin}
              className="text-primary hover:underline"
            >
              {t('auth.signIn')}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}