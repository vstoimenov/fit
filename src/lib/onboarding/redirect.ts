/** Where the app sends someone who has not finished the online questions; null = let her in. */
export function onboardingRedirect(profile: {
  onboarding_done: boolean;
  studio_client: boolean;
}): string | null {
  if (profile.onboarding_done) return null;
  // She trains in the gym: her page is the schedule and her card, not the online club's funnel.
  return profile.studio_client ? "/zala" : "/start";
}
