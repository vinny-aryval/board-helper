/**
 * Google Gemini integration for generating subtask descriptions
 */

import { StoryContext, AIGeneratedDescription } from './types';

interface Env {
  GEMINI_API_KEY: string;
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

const DISCLAIMER = `⚠️ **AUTO-GENERATED CONTENT** - Please verify with the parent story and confirm details with the reporter before starting work.

---

`;

const SYSTEM_PROMPT = `You are an expert software engineering assistant that helps break down user stories into detailed implementation subtasks.

CRITICAL RULES:
1. ONLY use information explicitly stated in the story description and acceptance criteria
2. DO NOT invent, assume, or hallucinate any details not provided
3. If information is missing, use placeholders like [TO BE DEFINED] or [ASK REPORTER]
4. Be conservative - it's better to leave sections empty than to guess
5. Mark any assumptions clearly with "ASSUMPTION:" prefix

Your responses should be based STRICTLY on the provided story content.`;

async function callGemini(prompt: string, env: Env): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: SYSTEM_PROMPT + '\n\n' + prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 1000 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Gemini API timeout - request took too long');
    }
    throw error;
  }
}

export async function generateBackendDescription(
  storyContext: StoryContext,
  env: Env
): Promise<AIGeneratedDescription> {
  const prompt = buildBackendPrompt(storyContext);
  const content = await callGemini(prompt, env);
  return { content: DISCLAIMER + content };
}

export async function generateFrontendDescription(
  storyContext: StoryContext,
  env: Env
): Promise<AIGeneratedDescription> {
  const prompt = buildFrontendPrompt(storyContext);
  const content = await callGemini(prompt, env);
  return { content: DISCLAIMER + content };
}

function buildBackendPrompt(context: StoryContext): string {
  return `Create a backend implementation subtask from this Jira story. Extract and organize ONLY the information provided.

Story Key: ${context.key}
Summary: ${context.summary}

Description:
${context.description || '[No description provided]'}
${context.figmaLink ? `\nDesign Link: ${context.figmaLink}` : ''}

FORMAT YOUR RESPONSE:

**Goal:**
[Summarize the backend functionality needed]

**Fields Required:**
[List ALL fields mentioned with types and validations]

**Business Logic:**
[Extract ALL business rules and validations mentioned]

**Technical Implementation:**
- Endpoint: [Suggest based on the feature]
- Method: [POST/PUT/GET]
- Request Body: [List fields]
- Response: [Success/error responses]

**Validation & Errors:**
[List ALL validations mentioned]

**Tests:**
- Unit tests for validations
- Integration tests for endpoint

IMPORTANT: Extract ALL fields and rules from the story. Do not skip requirements.`;
}

function buildFrontendPrompt(context: StoryContext): string {
  return `Create a frontend implementation subtask from this Jira story. Extract and organize ONLY the information provided.

Story Key: ${context.key}
Summary: ${context.summary}

Description:
${context.description || '[No description provided]'}
${context.figmaLink ? `\nDesign Link: ${context.figmaLink}` : ''}

FORMAT YOUR RESPONSE:

**Goal:**
[Summarize the UI functionality needed]

**Design:**
${context.figmaLink ? `[${context.figmaLink}]` : '[Design link needed]'}

**UI Components & Fields:**
[List ALL form fields and UI elements mentioned]

**Validations (Frontend):**
[Extract ALL frontend validations and error messages]

**User Flow:**
[Describe entry point, steps, success state, error handling]

**Tests:**
- E2E tests for complete flow
- Component tests for validations

IMPORTANT: Extract ALL fields and validations. Note the entry point and navigation flow.`;
}
