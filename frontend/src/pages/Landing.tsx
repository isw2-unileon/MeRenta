import { Hero } from "@/components/landing/Hero";
import { Stats } from "@/components/landing/Stats";
import { Categories } from "@/components/landing/Categories";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Trust } from "@/components/landing/Trust";

function Landing() {
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
