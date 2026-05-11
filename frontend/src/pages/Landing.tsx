import { Hero } from "@/components/landing/Hero";
import { Stats } from "@/components/landing/Stats";
import { Categories } from "@/components/landing/Categories";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Trust } from "@/components/landing/Trust";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/**
 * Public marketing landing page that redirects authenticated users home.
 * @returns The landing page sections or a redirect when logged in.
 */
function Landing() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to="/home"
        replace
      />
    );
  }

  return (
    <main className="pt-navbar">
      <Hero />
      <Stats />
      <Categories />
      <HowItWorks />
      <Trust />
    </main>
  );
}

export { Landing };
