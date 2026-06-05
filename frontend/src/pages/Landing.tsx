import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { Hero } from "@/components/landing/Hero";
import { Stats } from "@/components/landing/Stats";
import { Categories } from "@/components/landing/Categories";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Trust } from "@/components/landing/Trust";
import { fetchLanding } from "@/components/landing/landingApi";
import { useAuth } from "@/hooks/useAuth";
import type { LandingResponse } from "@/types/landing";

/**
 * Public marketing landing page. Pulls live marketplace data (stats, featured
 * listings and active categories) and redirects authenticated users home.
 * @returns The landing page sections or a redirect when logged in.
 */
function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  const [data, setData] = useState<LandingResponse | undefined>(undefined);

  useEffect(() => {
    if (isAuthenticated) return;

    const controller = new AbortController();

    fetchLanding(controller.signal)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // The marketing copy still renders without live data, so failures are non-fatal.
        setData(undefined);
      });

    return () => controller.abort();
  }, [isAuthenticated]);

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
      <Hero featured={data?.featured ?? []} />
      {data && <Stats stats={data.stats} />}
      {data && <Categories categories={data.categories} />}
      <HowItWorks />
      <Trust />
    </main>
  );
}

export { Landing };
