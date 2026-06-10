'use server';
/**
 * @fileOverview A Genkit flow for generating detailed geopolitical lore for a set of fictional countries.
 *
 * - generateGameWorldLore - A function that orchestrates the generation of country lore.
 * - GenerateGameWorldLoreInput - The input type for the generateGameWorldLore function.
 * - GenerateGameWorldLoreOutput - The return type for the generateGameWorldLore function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema for the flow
const GenerateGameWorldLoreInputSchema = z.object({
  countries: z.array(
    z.object({
      id: z.string().describe('Unique identifier for the country.'),
      name: z.string().describe('The initial name of the country.'),
    })
  ).describe('A list of initial country data to generate lore for.'),
});
export type GenerateGameWorldLoreInput = z.infer<typeof GenerateGameWorldLoreInputSchema>;

// Output Schemas
const DiplomaticRelationshipSchema = z.object({
  targetCountryId: z.string().describe('The ID of the country this relationship is with.'),
  targetCountryName: z.string().describe('The name of the country this relationship is with.'),
  type: z.enum(['ally', 'neutral', 'rival', 'enemy', 'vassal', 'overlord', 'disputed']).describe('Type of diplomatic relationship.'),
  description: z.string().describe('A brief explanation of the relationship.'),
});

const NamingConventionSchema = z.object({
  languageInfluence: z.string().describe('Brief description of the linguistic influences on naming.'),
  cityNamesExamples: z.array(z.string()).describe('Examples of city names following the convention.'),
  riverNamesExamples: z.array(z.string()).describe('Examples of river names following the convention.'),
  historicalFiguresNamesExamples: z.array(z.string()).describe('Examples of names for historical figures.'),
});

const CountryLoreSchema = z.object({
  id: z.string().describe('Unique identifier for the country.'),
  name: z.string().describe('The name of the country.'),
  historicalNarrative: z.string().describe('A detailed historical narrative for the country, including key events, conflicts, and cultural developments.'),
  diplomaticRelationships: z.array(DiplomaticRelationshipSchema).describe('Diplomatic relationships with other countries, providing context and current status.'),
  namingConventions: NamingConventionSchema.describe('Naming conventions for places and people within the country.'),
});

const GenerateGameWorldLoreOutputSchema = z.object({
  countriesLore: z.array(CountryLoreSchema).describe('A list of detailed lore for each country.'),
});
export type GenerateGameWorldLoreOutput = z.infer<typeof GenerateGameWorldLoreOutputSchema>;

// Wrapper function for the flow
export async function generateGameWorldLore(
  input: GenerateGameWorldLoreInput
): Promise<GenerateGameWorldLoreOutput> {
  return generateGameWorldLoreFlow(input);
}

// Prompt definition
const generateLorePrompt = ai.definePrompt({
  name: 'generateLorePrompt',
  input: { schema: GenerateGameWorldLoreInputSchema },
  output: { schema: GenerateGameWorldLoreOutputSchema },
  prompt: `You are an expert geopolitical historian and world-builder for a strategy game. Your task is to generate detailed lore for a set of fictional countries on a new world map. For each country, you need to create a unique historical narrative, define its diplomatic relationships with other countries in the provided list, and establish its distinctive naming conventions.\n\nThe output should be a JSON array of country lore objects, each containing an ID, name, historical narrative, a list of diplomatic relationships, and naming conventions.\n\nEnsure that:\n1.  **Historical Narratives** are rich and provide context for the current diplomatic relationships. They should cover key events, conflicts, and cultural developments.\n2.  **Diplomatic Relationships** are plausible and reflect a history of interactions, conflicts, or alliances between the listed countries. The relationships should be diverse (ally, neutral, rival, enemy, vassal, overlord, disputed). Every country should have at least one relationship defined with another country from the input list, if possible.\n3.  **Naming Conventions** feel consistent with the country's history and cultural identity. Provide examples for city names, river names, and historical figures' names, along with a description of the linguistic influence.\n\nHere is the list of countries for which you need to generate lore. Use their IDs for targetCountryId in diplomatic relationships:\n\n{{#each countries}}\n- ID: {{this.id}}, Name: {{this.name}}\n{{/each}}\n\nGenerate the full JSON output directly, without any additional conversational text.`,
});

// Flow definition with simple retry logic
const generateGameWorldLoreFlow = ai.defineFlow(
  {
    name: 'generateGameWorldLoreFlow',
    inputSchema: GenerateGameWorldLoreInputSchema,
    outputSchema: GenerateGameWorldLoreOutputSchema,
  },
  async (input) => {
    let attempts = 0;
    const maxAttempts = 3;
    const delay = 2000; // 2 seconds

    while (attempts < maxAttempts) {
      try {
        const {output} = await generateLorePrompt(input);
        if (!output) throw new Error('Lore generation returned no output');
        return output;
      } catch (error: any) {
        attempts++;
        const isUnavailable = error?.message?.includes('503') || error?.message?.includes('Service Unavailable') || error?.message?.includes('high demand');
        
        if (isUnavailable && attempts < maxAttempts) {
          console.warn(`Lore generation attempt ${attempts} failed due to service demand. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay * attempts)); // Exponential backoff
          continue;
        }
        
        console.error('Final attempt at lore generation failed:', error);
        throw error;
      }
    }
    throw new Error('Lore generation failed after multiple retries');
  }
);