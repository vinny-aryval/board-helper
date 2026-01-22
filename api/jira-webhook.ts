/**
 * Main webhook handler for Jira automation
 * Receives webhooks from Jira when a Story moves to "Ready for Dev"
 * and creates backend/frontend subtasks with AI-generated descriptions
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import {
  JiraWebhookPayload,
  StoryContext,
  SubtaskInput,
  SubtaskType,
} from '../lib/types';
import { validateWebhookSignature } from '../lib/validation';
import {
  getIssue,
  createSubtask,
  updateIssueDescription,
  subtaskExists,
} from '../lib/jira';
import {
  generateBackendDescription,
  generateFrontendDescription,
} from '../lib/openai';

/**
 * Main webhook handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    console.log('Received webhook request');

    // Validate webhook signature
    const webhookSecret = process.env.WEBHOOK_SECRET || '';
    const signature = req.headers['x-hub-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    if (!validateWebhookSignature(rawBody, signature, webhookSecret)) {
      console.error('Invalid webhook signature');
      res.status(401).json({ error: 'Unauthorized - Invalid signature' });
      return;
    }

    console.log('Webhook signature validated successfully');

    // Parse webhook payload
    const payload = req.body as JiraWebhookPayload;

    // Validate payload structure
    if (!payload.issue || !payload.issue.key) {
      console.error('Invalid webhook payload - missing issue information');
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const issueKey = payload.issue.key;
    const issueType = payload.issue.fields.issuetype.name;

    console.log(`Processing issue: ${issueKey} (${issueType})`);

    // Only process Story issues
    if (issueType !== 'Story') {
      console.log(`Ignoring non-Story issue type: ${issueType}`);
      res.status(200).json({
        message: `Ignored - only Stories are processed, received: ${issueType}`,
      });
      return;
    }

    // Check if status changed to "Ready for Dev"
    const statusChanged = payload.changelog?.items?.some(
      (item) =>
        item.field === 'status' &&
        item.toString.toLowerCase() === 'ready for dev'
    );

    if (!statusChanged) {
      console.log('Issue status did not change to "Ready for Dev"');
      res.status(200).json({
        message: 'Ignored - status not changed to "Ready for Dev"',
      });
      return;
    }

    console.log(`Issue ${issueKey} moved to "Ready for Dev" - processing...`);

    // Fetch full story details
    const story = await getIssue(issueKey);

    // Extract story context for AI processing
    const storyContext = extractStoryContext(story);

    // Check if subtasks already exist (idempotency)
    const backendExists = await subtaskExists(issueKey, SubtaskType.BACKEND);
    const frontendExists = await subtaskExists(issueKey, SubtaskType.FRONTEND);

    if (backendExists && frontendExists) {
      console.log(
        `Subtasks already exist for ${issueKey} - skipping creation`
      );
      res.status(200).json({
        message: 'Subtasks already exist',
        story: issueKey,
      });
      return;
    }

    // Create subtasks
    const subtasksCreated: { type: SubtaskType; key: string }[] = [];

    // Create backend subtask if it doesn't exist
    if (!backendExists) {
      console.log('Creating backend subtask...');
      const backendSubtask = await createSubtask(issueKey, {
        summary: `[Backend] ${story.fields.summary}`,
        description: 'Generating AI description...',
        subtaskType: SubtaskType.BACKEND,
        labels: ['auto-generated', 'backend'],
      });

      subtasksCreated.push({
        type: SubtaskType.BACKEND,
        key: backendSubtask.key,
      });

      // Generate and update backend description
      console.log('Generating backend description with AI...');
      const backendDescription = await generateBackendDescription(
        storyContext
      );
      await updateIssueDescription(
        backendSubtask.key,
        backendDescription.content
      );
      console.log(`Backend subtask ${backendSubtask.key} updated with AI content`);
    }

    // Create frontend subtask if it doesn't exist
    if (!frontendExists) {
      console.log('Creating frontend subtask...');
      const frontendSubtask = await createSubtask(issueKey, {
        summary: `[Frontend] ${story.fields.summary}`,
        description: 'Generating AI description...',
        subtaskType: SubtaskType.FRONTEND,
        labels: ['auto-generated', 'frontend'],
      });

      subtasksCreated.push({
        type: SubtaskType.FRONTEND,
        key: frontendSubtask.key,
      });

      // Generate and update frontend description
      console.log('Generating frontend description with AI...');
      const frontendDescription = await generateFrontendDescription(
        storyContext
      );
      await updateIssueDescription(
        frontendSubtask.key,
        frontendDescription.content
      );
      console.log(`Frontend subtask ${frontendSubtask.key} updated with AI content`);
    }

    console.log(`Successfully processed ${issueKey}`);
    res.status(200).json({
      message: 'Subtasks created successfully',
      story: issueKey,
      subtasks: subtasksCreated,
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Extract story context for AI processing
 * @param story - Full Jira issue object
 * @returns StoryContext object
 */
function extractStoryContext(story: any): StoryContext {
  // Extract description text (handle both plain text and Jira Document Format)
  let description = '';
  if (story.fields.description) {
    if (typeof story.fields.description === 'string') {
      description = story.fields.description;
    } else if (story.fields.description.content) {
      // Parse Jira Document Format
      description = extractTextFromJiraDoc(story.fields.description);
    }
  }

  // Try to extract acceptance criteria (often in description or custom field)
  const acceptanceCriteria = extractAcceptanceCriteria(description);

  // Extract Figma link from description or custom field
  const figmaLink = extractFigmaLink(description, story.fields);

  return {
    key: story.key,
    summary: story.fields.summary || '',
    description,
    acceptanceCriteria,
    figmaLink,
    labels: story.fields.labels || [],
    components: story.fields.components?.map((c: any) => c.name) || [],
  };
}

/**
 * Extract plain text from Jira Document Format
 * @param doc - Jira document object
 * @returns Plain text string
 */
function extractTextFromJiraDoc(doc: any): string {
  if (!doc || !doc.content) return '';

  let text = '';
  for (const node of doc.content) {
    if (node.type === 'paragraph' && node.content) {
      for (const content of node.content) {
        if (content.type === 'text') {
          text += content.text + '\n';
        }
      }
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      if (node.content) {
        for (const item of node.content) {
          if (item.content) {
            text += '- ' + extractTextFromJiraDoc(item) + '\n';
          }
        }
      }
    }
  }
  return text.trim();
}

/**
 * Extract acceptance criteria from description
 * @param description - Story description
 * @returns Acceptance criteria text or undefined
 */
function extractAcceptanceCriteria(description: string): string | undefined {
  // Look for common patterns for acceptance criteria
  const patterns = [
    /acceptance criteria:?\s*([\s\S]*?)(?=\n\n|$)/i,
    /ac:?\s*([\s\S]*?)(?=\n\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Extract Figma link from description or fields
 * @param description - Story description
 * @param fields - Jira fields object
 * @returns Figma URL or undefined
 */
function extractFigmaLink(description: string, fields: any): string | undefined {
  // Look for Figma URLs in description
  const figmaPattern = /https?:\/\/(?:www\.)?figma\.com\/[^\s]*/i;
  const match = description.match(figmaPattern);

  if (match) {
    return match[0];
  }

  // Check common custom field for Figma link
  if (fields.customfield_10037) {
    return fields.customfield_10037;
  }

  return undefined;
}
