export interface LandmarkRequirement {
  label: string;
  pattern: RegExp;
}

export interface LandmarkCheckResult {
  ok: boolean;
  missing: string[];
}

export function checkLandmarks(
  source: string,
  requirements: readonly LandmarkRequirement[]
): LandmarkCheckResult {
  const missing: string[] = [];
  for (const req of requirements) {
    if (!req.pattern.test(source)) missing.push(req.label);
  }
  return { ok: missing.length === 0, missing };
}
