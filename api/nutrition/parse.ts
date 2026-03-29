import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are a nutrition database expert. Parse natural language food descriptions into structured nutritional data.

For each food item mentioned, return accurate USDA-aligned nutritional estimates per the specified quantity/serving.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "items": [
    {
      "food_name": "Eggs",
      "serving_description": "3 large",
      "calories": 210,
      "protein_g": 18,
      "carbs_g": 1.5,
      "fat_g": 15,
      "fiber_g": 0,
      "sugar_g": 0.5,
      "sodium_mg": 210,
      "micronutrients": {
        "vitamin_d_mcg": 3,
        "calcium_mg": 84,
        "iron_mg": 2.7,
        "potassium_mg": 200
      }
    }
  ]
}

Rules:
- Split each distinct food into its own item
- Use commonly accepted nutritional values
- All numeric values should be numbers (not strings)
- Include key micronutrients when significant (vitamin_a_mcg, vitamin_c_mg, vitamin_d_mcg, calcium_mg, iron_mg, potassium_mg, magnesium_mg, zinc_mg)
- If a quantity is ambiguous (e.g. "some rice"), assume a standard serving
- Handle metric (g, ml) and imperial (oz, cups, tbsp) units
- Be accurate with calorie and macro calculations`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { input } = req.body;

  if (!input || typeof input !== 'string' || input.trim().length === 0) {
    return res.status(400).json({ error: 'Missing food description' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Parse this food log entry: "${input.trim()}"` },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return res.status(500).json({ error: 'No response from AI' });
    }

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.items || !Array.isArray(parsed.items)) {
      return res.status(500).json({ error: 'Invalid AI response format' });
    }

    return res.status(200).json({
      items: parsed.items,
      raw_input: input.trim(),
    });
  } catch (err) {
    console.error('Food parsing failed:', err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
