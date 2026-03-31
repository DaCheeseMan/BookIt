import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { Hero } from '../components/landing/Hero';
import { Features } from '../components/landing/Features';
import { HowItWorks } from '../components/landing/HowItWorks';
import { Pricing } from '../components/landing/Pricing';
import { FAQ } from '../components/landing/FAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { Footer } from '../components/landing/Footer';

export function LandingPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  function handleGetStarted() {
    if (auth.isAuthenticated) {
      navigate('/tenants');
    } else {
      auth.signinRedirect();
    }
  }

  return (
    <div>
      {/* Skip to main content for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>
      <LandingNavbar />
      <main id="main-content">
        <Hero onGetStarted={handleGetStarted} />
        <Features />
        <HowItWorks />
        <Pricing onGetStarted={handleGetStarted} />
        <FAQ />
        <FinalCTA onGetStarted={handleGetStarted} />
      </main>
      <Footer />
    </div>
  );
}
