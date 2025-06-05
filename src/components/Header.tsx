import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { useLanguageHook as useLanguage } from "../lib/use-language";
import { Button } from "./ui/button";
import AuthModal from "./auth/AuthModal";
import { Link } from "react-router-dom";
import LanguageSelector from "./LanguageSelector";
import aykreaLogo from "../assets/aykrea-logo.png"

export default function Header() {
  const { user, signOut, subscription } = useAuth();
  const { t } = useLanguage();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <header className="border-b p-4 bg-primary/10">
      <div className="container mx-auto flex items-center justify-between">
        <div>
         <img src={aykreaLogo} alt="Aykrea Logo" className="w-32"/>
        </div>

        <div>
          {user ? (
            <div className="flex items-center gap-4">
              <LanguageSelector />
            
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-muted-foreground hidden md:inline-block">
                  {user.email}
                </span>
                <span className="text-sm text-muted-foreground hidden md:inline-block">
                  {subscription?.tier &&
                    subscription?.tier[0].toUpperCase() +
                      subscription?.tier.slice(1)}{" "}
                  {t('header.plan')}
                </span>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard">{t('header.dashboard')}</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/my-content">{t('header.myContent')}</Link>
              </Button>
              <Button variant="link" className="p-0 h-auto text-sm" asChild>
                <Link to="/plans">{t('header.viewPlans')}</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={signOut}>
                {t('header.signOut')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <LanguageSelector />
              <Button onClick={() => setIsAuthModalOpen(true)}>{t('auth.signIn')}</Button>
            </div>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </header>
  );
}
