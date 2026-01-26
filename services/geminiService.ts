import { GoogleGenAI } from "@google/genai";
import { EvolutionStage } from "../types";
import { EVO_CONFIG } from "../constants";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateMissionDebrief = async (
  score: number,
  stage: EvolutionStage,
  deathCause: 'PIPE' | 'GROUND' | 'CEILING'
): Promise<string> => {
  const client = getClient();
  if (!client) {
    return "Mission Failed. (API Key missing for detailed analysis)";
  }

  const stageName = EVO_CONFIG[stage].name;

  let causeText = 'unknown causes';
  if (deathCause === 'PIPE') causeText = 'an energy barrier';
  else if (deathCause === 'GROUND') causeText = 'the void floor';
  else if (deathCause === 'CEILING') causeText = 'the atmospheric containment field';

  const prompt = `
    You are a sarcastic, sci-fi military AI debriefing a pilot who just crashed in a simulation.
    
    Stats:
    - Pilot Score: ${score}
    - Evolution Stage Reached: ${stageName}
    - Cause of Death: Hit ${causeText}

    Write a very short (max 2 sentences), witty, and slightly mocking mission debrief. 
    If the score is low (< 5), mock their incompetence. 
    If the score is high (> 15), praise their reflexes but mock their inevitable demise.
  `;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Communication interference. Data lost.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI Core Offline. Unable to generate debrief.";
  }
};