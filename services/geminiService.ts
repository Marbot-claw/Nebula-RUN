import { EvolutionStage } from \"../types\";

export const generateMissionDebrief = async (
  score: number,
  stage: EvolutionStage,
  deathCause: 'PIPE' | 'GROUND' | 'CEILING'
): Promise<string> => {
  try {
    // API Key is now handled securely on the backend
    const response = await fetch('/api/debrief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, stage, deathCause }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch debrief');
    }

    const data = await response.json();
    return data.message || \"Communication interference. Data lost.\";
  } catch (error) {
    console.error(\"Debrief Error:\", error);
    return \"AI Core Offline. Unable to generate debrief.\";
  }
};
