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
  prompt: `You are a master world-builder and geopolitical historian. Your task is to generate immersive lore and names for a set of countries in a strategy game sandbox.

### CRITICAL INSTRUCTION FOR COUNTRY NAMES:
Instead of completely random fantasy names, generate fictional names inspired by real-world geography, regions, states, and cities. Mix or slightly modify these to create unique "alternate-history" style names.

**Sources of Inspiration (Mix & Match):**
- **Europe/Eurasia**: Silesia, Bavaria, Aquitaine, Pomerania, Thrace, Anatolia, Crimea, Ural.
- **Asia/Pacific**: Sunda, Hokkaido, Punjab, Malabar, Gobi, Bengal, Mindanao, Kanto.
- **Africa**: Sahel, Rif, Maghreb, Serengeti, Zambezi, Dahomey, Nubia.
- **Americas**: Cascadia, Acadia, Yucatan, Patagonia, Atacama, Darien, Appalachia.
- **Middle East**: Levant, Hejaz, Mesopotamia, Elam, Petra, Shiraz.

**How to Modify Names:**
1.  **Compound Names**: Combine a geographic root with a direction or descriptor (e.g., "North Aquitaine", "Lower Sunda", "Great Uralia").
2.  **Linguistic Shifts**: Change suffixes (e.g., Silesia -> Silesian Commonwealth, Maghreb -> Maghrebia, Thrace -> Thracian Coast).
3.  **Historical Blends**: Imagine a merger of cultures (e.g., "Cascadia-Nord", "Balkan-Rim", "Indo-Sunda").
4.  **Descriptive Regions**: Use geological features (e.g., "The Altiplano Republic", "Sunda-Archipelago", "Sahara-Sud").

DO NOT use modern sovereign state names directly (e.g., No "France", "Japan", "Brazil"). Instead, use regional identities to create a sense of place.

### Deliverables for each country:
1.  **Name**: A unique, striking name that feels grounded in real-world geography.
2.  **Historical Narrative**: A rich history explaining how this regional entity became a power.
3.  **Diplomatic Relationships**: How it views the *other* countries in this specific list? (Use their IDs).
4.  **Naming Conventions**: Provide 3-5 examples of cities, rivers, and heroes that follow the country's phonetic style.

Input Countries:
{{#each countries}}
- ID: {{this.id}}, Initial placeholder: {{this.name}}
{{/each}}

Ensure the JSON output is complete and strictly adheres to the schema.`,
});

// Flow definition with robust retry logic
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
        
        if (attempts >= maxAttempts) {
          console.warn('Lore generation failed all retries. Using fallback geographically inspired names.');
          const fallbackNames = [
            "North Cascadia", "Sunda-Isles", "Balkan-Rim", "Great Pomerania", 
            "Levant-Sud", "Uralian League", "Maghrebia", "Andean Union",
            "Silesian Reach", "Kanto-West", "Sahelian Coast", "Patagonian Core"
          ];
          return {
            countriesLore: input.countries.map((c, i) => ({
              id: c.id,
              name: fallbackNames[i % fallbackNames.length] || `Region ${c.name}`,
              historicalNarrative: "A regional power with a complex history defined by its geography and local traditions.",
              diplomaticRelationships: [],
              namingConventions: {
                languageInfluence: "Geographically grounded and historic",
                cityNamesExamples: ["Capital City", "Port Royal"],
                riverNamesExamples: ["Great River"],
                historicalFiguresNamesExamples: ["The Founder"]
              }
            }))
          };
        }
      }
    }
    
    return { countriesLore: [] };
  }
);