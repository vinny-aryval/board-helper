/**
 * Cloudflare Worker - Jira Subtask Automation
 */

import { JiraWebhookPayload, StoryContext, SubtaskType } from '../lib/types';
import { validateWebhookSignature } from '../lib/validation';
import { createSubtask, subtaskExists } from '../lib/jira';
import { generateBackendDescription, generateFrontendDescription } from '../lib/gemini';

export interface Env {
  GEMINI_API_KEY: string;
  JIRA_BASE_URL: string;
  JIRA_EMAIL: string;
  JIRA_API_TOKEN: string;
  WEBHOOK_SECRET: string;
  JIRA_READY_STATUS?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Only accept POST to /api/jira-webhook or /
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }
    if (url.pathname !== '/' && url.pathname !== '/api/jira-webhook') {
      return jsonResponse({ error: 'Not found' }, 404);
    }

    try {
      const rawBody = await request.text();

      // Validate webhook signature if configured
      const webhookSecret = env.WEBHOOK_SECRET || '';
      const signature = request.headers.get('x-hub-signature') || '';
      if (webhookSecret && signature && !(await validateWebhookSignature(rawBody, signature, webhookSecret))) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      // Parse payload (sanitize Jira's unescaped newlines)
      const payload = parseJiraPayload(rawBody);
      if (!payload?.issue?.key) {
        return jsonResponse({ error: 'Invalid payload' }, 400);
      }

      const { key: issueKey, fields } = payload.issue;
      const issueType = fields.issuetype.name;

      // Only process Stories
      if (issueType !== 'Story') {
        return jsonResponse({ message: `Ignored - not a Story (${issueType})` });
      }

      // Check status transition
      const targetStatus = env.JIRA_READY_STATUS || 'Ready for Dev';
      const statusChanged = payload.changelog?.items?.some(
        item => item.field === 'status' && item.toString.toLowerCase() === targetStatus.toLowerCase()
      );
      if (!statusChanged) {
        return jsonResponse({ message: `Ignored - status not "${targetStatus}"` });
      }

      console.log(`Processing ${issueKey}...`);

      // Extract story context
      const storyContext = extractStoryContext(payload);

      // Check idempotency
      const [backendExists, frontendExists] = await Promise.all([
        subtaskExists(issueKey, SubtaskType.BACKEND, env),
        subtaskExists(issueKey, SubtaskType.FRONTEND, env),
      ]);

      if (backendExists && frontendExists) {
        return jsonResponse({ message: 'Subtasks already exist', story: issueKey });
      }

      // Generate AI descriptions in PARALLEL for speed
      const [backendDesc, frontendDesc] = await Promise.all([
        !backendExists ? generateBackendDescription(storyContext, env) : null,
        !frontendExists ? generateFrontendDescription(storyContext, env) : null,
      ]);

      // Create subtasks
      const subtasksCreated: { type: SubtaskType; key: string }[] = [];

      if (backendDesc) {
        const subtask = await createSubtask(issueKey, {
          summary: `[Backend] ${storyContext.summary}`,
          description: backendDesc.content,
          subtaskType: SubtaskType.BACKEND,
          labels: ['auto-generated', 'backend'],
        }, env);
        subtasksCreated.push({ type: SubtaskType.BACKEND, key: subtask.key });
        console.log(`Created backend subtask: ${subtask.key}`);
      }

      if (frontendDesc) {
        const subtask = await createSubtask(issueKey, {
          summary: `[Frontend] ${storyContext.summary}`,
          description: frontendDesc.content,
          subtaskType: SubtaskType.FRONTEND,
          labels: ['auto-generated', 'frontend'],
        }, env);
        subtasksCreated.push({ type: SubtaskType.FRONTEND, key: subtask.key });
        console.log(`Created frontend subtask: ${subtask.key}`);
      }

      console.log(`Done: ${issueKey}`);
      return jsonResponse({ message: 'Subtasks created', story: issueKey, subtasks: subtasksCreated });

    } catch (error) {
      console.error('Error:', error);
      return jsonResponse({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  },
};

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseJiraPayload(rawBody: string): JiraWebhookPayload | null {
  try {
    // Escape unescaped newlines in JSON string values (Jira Automation quirk)
    const sanitized = rawBody.replace(
      /"([^"\\]|\\.)*"/g,
      match => match.replace(/[\n\r\t]/g, c => c === '\n' ? '\\n' : c === '\r' ? '\\r' : '\\t')
    );
    return JSON.parse(sanitized);
  } catch {
    console.error('Failed to parse payload');
    return null;
  }
}

function extractStoryContext(payload: JiraWebhookPayload): StoryContext {
  const description = payload.issue.fields.description || '';
  const cleaned = cleanJiraMarkup(description);
  
  return {
    key: payload.issue.key,
    summary: payload.issue.fields.summary || '',
    description: cleaned,
    acceptanceCriteria: extractAcceptanceCriteria(cleaned),
    figmaLink: extractFigmaLink(description),
    labels: payload.issue.fields.labels || [],
    components: payload.issue.fields.components?.map((c: any) => c.name) || [],
  };
}

function cleanJiraMarkup(text: string): string {
  if (!text) return '';
  return text
    .replace(/\{panel[^}]*\}|\{panel\}/g, '')
    .replace(/h(\d)\.\s*/g, '\n## ')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\{\{([^}]+)\}\}/g, '`$1`')
    .replace(/\[([^\]|]+)\|([^\]|]+)(?:\|[^\]]+)?\]/g, '$1 ($2)')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\|smart-link\]|\|smart-embed\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractFigmaLink(text: string): string | undefined {
  const match = text.match(/https?:\/\/(?:www\.)?figma\.com\/(?:design|file)\/[^\s\]|]+/i);
  return match?.[0]?.replace(/[|)\]]+$/, '');
}

function extractAcceptanceCriteria(text: string): string | undefined {
  const match = text.match(/(?:acceptance criteria|ac)[:\s]*\n([\s\S]*?)(?=\n##|\n\*\*[A-Z]|$)/i);
  return match?.[1]?.trim();
}
