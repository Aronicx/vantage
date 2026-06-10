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
  prompt: `You are a master world-builder and geopolitical historian specializing in grand strategy games like Europa Universalis, Crusader Kings, and high-fantasy settings. 

Your task is to generate immersive, creative, and phonetically unique lore for a set of countries.

### CRITICAL INSTRUCTION FOR COUNTRY NAMES:
Avoid generic, repetitive, or cliché names (e.g., "Nation A", "United Kingdom", "The Republic", "Kingdom of [Name]"). Instead, craft names that sound like they have deep linguistic roots and historical weight. 

Think across different phonetic spectrums:
- **Guttural & Harsh**: (e.g., Khurzak, Vroth-Gar, Zarakh-Thul) - often associated with rugged terrain or militaristic cultures.
- **Melodic & Ethereal**: (e.g., Aethelgard, Olyndia, Valysria, Lyonesse) - often associated with ancient lineages or maritime power.
- **Evocative & Descriptive**: (e.g., Iron-Reach, Mist-Hollow, The Sunder-Isles, Cloud-Blight) - names that reflect geography or a defining event.
- **Ancient & Latinate**: (e.g., Aurelium, Praetoria, Argentia) - reflecting fallen empires or clerical traditions.
- **Syllabic & Unique**: (e.g., Tenoch-Tla, Shambala-Desh, Kymur-Zai).

DO NOT use real-world country names directly. Instead, invent new words that feel authentic to a fictional world.

### Deliverables for each country:
1.  **Name**: A unique, striking name that fits a strategy game map.
2.  **Historical Narrative**: A rich history. Why is this country here? What major war or cultural shift defined its current borders?
3.  **Diplomatic Relationships**: How does it view the *other* countries in this specific list? (Use their IDs). Create meaningful rivalries (territorial disputes, ancient grudges) or alliances (trade pacts, shared ancestry).
4.  **Naming Conventions**: Explain the "sound" of their language and provide 3-5 examples of cities, rivers, and heroes that share this phonetic style.

Input Countries:
{{#each countries}}
- ID: {{this.id}}, Initial placeholder: {{this.name}}
{{/each}}

Ensure the JSON output is complete and strictly adheres to the schema.`,
});

// Flow definition with more robust retry logic and fallback
const generateGameWorldLoreFlow = ai.defineFlow(
  {
    name: 'generateGameWorldLoreFlow',
    inputSchema: GenerateGameWorldLoreInputSchema,
    outputSchema: GenerateGameWorldLoreOutputSchema,
  },
  async (input) => {
    let attempts = 0;
    const maxAttempts = 5;
    const baseDelay = 3000;

    while (attempts < maxAttempts) {
      try {
        const {output} = await generateLorePrompt(input);
        if (!output) throw new Error('Lore generation returned no output');
        return output;
      } catch (error: any) {
        attempts++;
        const errorMessage = error?.message || '';
        const isUnavailable = errorMessage.includes('503') || 
                             errorMessage.includes('Service Unavailable') || 
                             errorMessage.includes('high demand') ||
                             errorMessage.includes('UNAVAILABLE');
        
        if (isUnavailable && attempts < maxAttempts) {
          const currentDelay = baseDelay * attempts;
          console.warn(`Lore generation attempt ${attempts} failed due to service demand. Retrying in ${currentDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, currentDelay)); 
          continue;
        }
        
        console.error(`Attempt ${attempts} at lore generation failed:`, error);
        
        // If we've exhausted retries, return a fallback instead of crashing
        if (attempts >= maxAttempts) {
          console.warn('Lore generation failed all retries. Using fallback empty lore.');
          return {
            countriesLore: input.countries.map(c => ({
              id: c.id,
              name: `Principality of ${c.name.split(' ')[1] || 'Unknown'}`,
              historicalNarrative: "The history of this land is shrouded in mystery and clouded by ancient wars.",
              diplomaticRelationships: [],
              namingConventions: {
                languageInfluence: "Archaic and guttural",
                cityNamesExamples: ["Old Port", "Castle Rock"],
                riverNamesExamples: ["Silver Flow"],
                historicalFiguresNamesExamples: ["The Unnamed King"]
              }
            }))
          };
        }
      }
    }
    
    // Final defensive fallback
    return { countriesLore: [] };
  }
);
