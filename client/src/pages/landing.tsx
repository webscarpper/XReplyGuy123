import Navigation from "@/components/ui/navigation";
import HeroSection from "@/components/sections/hero-section";
import AuthoritySection from "@/components/sections/authority-section";
import FeaturesSection from "@/components/sections/features-section";
import SocialProofSection from "@/components/sections/social-proof-section";
import HowItWorksSection from "@/components/sections/how-it-works-section";
import PricingSection from "@/components/sections/pricing-section";
import ExclusivitySection from "@/components/sections/exclusivity-section";
import Footer from "@/components/ui/footer";
import PhantomLogin from "@/components/auth/phantom-login";
import { useState } from "react";

export default function LandingPage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const handleLoginSuccess = (walletAddress: string, invitationCode?: string) => {
    console.log('Login successful:', { walletAddress, invitationCode });
    // Here you would typically store user data in context/state
    // and redirect to the dashboard or show success message
  };

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white overflow-x-hidden">
      <Navigation 
        onWalletConnect={() => setIsLoginModalOpen(true)}
        onInviteClick={() => setIsLoginModalOpen(true)}
      />
      
      <HeroSection 
        onWalletConnect={() => setIsLoginModalOpen(true)}
        onInviteClick={() => setIsLoginModalOpen(true)}
      />
      
      <AuthoritySection />
      <FeaturesSection />
      <SocialProofSection />
      <HowItWorksSection />
      <PricingSection onWalletConnect={() => setIsLoginModalOpen(true)} />
      <ExclusivitySection onWalletConnect={() => setIsLoginModalOpen(true)} />
      
      <Footer />
      
      <PhantomLogin 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </div>
  );
}
