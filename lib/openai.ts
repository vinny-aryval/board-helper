/**
 * OpenAI integration for generating subtask descriptions
 */

import OpenAI from 'openai';
import { StoryContext, AIGeneratedDescription, SubtaskType } from './types';
import { BACKEND_TEMPLATE, FRONTEND_TEMPLATE } from './templates';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Build system prompt for AI
 */
const SYSTEM_PROMPT = `You are an expert software engineering assistant that helps break down user stories into detailed implementation subtasks. Your responses should be:
- Structured and consistent with the provided template
- Technical but clear
- Focused on implementation details
- Draft quality that engineers can refine

Remember: You're providing a helpful starting point, not the final authority. Engineers will review and adjust your output.`;

/**
 * Generate backend subtask description using AI
 * @param storyContext - Context from the parent story
 * @returns AI-generated description
 */
export async function generateBackendDescription(
  storyContext: StoryContext
): Promise<AIGeneratedDescription> {
  try {
    console.log(
      `Generating backend description for story: ${storyContext.key}`
    );

    const userPrompt = buildBackendPrompt(storyContext);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content || '';
    const tokenUsage = completion.usage?.total_tokens;

    console.log(
      `Backend description generated. Tokens used: ${tokenUsage || 'N/A'}`
    );

    return {
      content,
      tokenUsage,
    };
  } catch (error) {
    console.error('Error generating backend description:', error);
    throw new Error(`Failed to generate backend description: ${error}`);
  }
}

/**
 * Generate frontend subtask description using AI
 * @param storyContext - Context from the parent story
 * @returns AI-generated description
 */
export async function generateFrontendDescription(
  storyContext: StoryContext
): Promise<AIGeneratedDescription> {
  try {
    console.log(
      `Generating frontend description for story: ${storyContext.key}`
    );

    const userPrompt = buildFrontendPrompt(storyContext);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content || '';
    const tokenUsage = completion.usage?.total_tokens;

    console.log(
      `Frontend description generated. Tokens used: ${tokenUsage || 'N/A'}`
    );

    return {
      content,
      tokenUsage,
    };
  } catch (error) {
    console.error('Error generating frontend description:', error);
    throw new Error(`Failed to generate frontend description: ${error}`);
  }
}

/**
 * Build prompt for backend subtask generation
 * @param context - Story context
 * @returns Formatted prompt string
 */
function buildBackendPrompt(context: StoryContext): string {
  return `Generate a backend implementation subtask description for the following story.

Story Key: ${context.key}
Summary: ${context.summary}

Description:
${context.description}

${context.acceptanceCriteria ? `Acceptance Criteria:\n${context.acceptanceCriteria}\n` : ''}
${context.figmaLink ? `Design Link: ${context.figmaLink}\n` : ''}
${context.labels.length > 0 ? `Labels: ${context.labels.join(', ')}\n` : ''}
${context.components.length > 0 ? `Components: ${context.components.join(', ')}\n` : ''}

Please fill out the following backend subtask template with specific implementation details:

${BACKEND_TEMPLATE}

Focus on:
1. Identifying the API endpoint structure based on the story
2. Extracting required fields from the description and acceptance criteria
3. Defining clear business rules
4. Specifying validation requirements
5. Outlining test scenarios`;
}

/**
 * Build prompt for frontend subtask generation
 * @param context - Story context
 * @returns Formatted prompt string
 */
function buildFrontendPrompt(context: StoryContext): string {
  return `Generate a frontend implementation subtask description for the following story.

Story Key: ${context.key}
Summary: ${context.summary}

Description:
${context.description}

${context.acceptanceCriteria ? `Acceptance Criteria:\n${context.acceptanceCriteria}\n` : ''}
${context.figmaLink ? `Design Link: ${context.figmaLink}\n` : ''}
${context.labels.length > 0 ? `Labels: ${context.labels.join(', ')}\n` : ''}
${context.components.length > 0 ? `Components: ${context.components.join(', ')}\n` : ''}

Please fill out the following frontend subtask template with specific implementation details:

${FRONTEND_TEMPLATE}

Focus on:
1. UI integration requirements
2. Frontend validation aligned with backend expectations
3. Error handling and user feedback
4. Loading states and edge cases
5. E2E testing scenarios`;
}
