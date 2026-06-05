import { buildStatTiles } from "@/components/landing/landingFormat";
import type { LandingStats } from "@/types/landing";

interface StatsProps {
  stats: LandingStats;
}

/**
 * Displays real marketplace metrics to build credibility.
 * @returns The stats strip shown on the landing page.
 */
function Stats({ stats }: StatsProps) {
  const tiles = buildStatTiles(stats);

  return (
    <section className="h-stats bg-page border-border-main px-layout-margin flex items-center border-t border-b">
      <div className="max-w-alert-width mx-auto grid w-full grid-cols-4">
        {tiles.map((tile, i) => (
          <div
            key={tile.label}
            className={`flex flex-col items-center gap-1 text-center ${
              i < tiles.length - 1 ? "border-border-main border-r" : ""
            }`}
          >
            <span className="stat-value">{tile.value}</span>
            <span className="stat-label">{tile.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export { Stats };
