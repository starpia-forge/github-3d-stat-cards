/** A Body's Tier, by the Subject's commits to the repository. */
export type Tier = "starlight" | "star" | "planet" | "nebula";

export const TIERS: Record<Tier, { min: number; size: number }> = {
  starlight: { min: 1, size: 1.6 },
  star: { min: 10, size: 3.2 },
  planet: { min: 50, size: 7 },
  nebula: { min: 200, size: 12 },
};

export function tierOf(commits: number): Tier {
  if (commits >= TIERS.nebula.min) return "nebula";
  if (commits >= TIERS.planet.min) return "planet";
  if (commits >= TIERS.star.min) return "star";
  return "starlight";
}
