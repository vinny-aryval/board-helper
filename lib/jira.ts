/**
 * Jira REST API helper functions
 */

import {
  JiraIssue,
  SubtaskInput,
  CreateSubtaskResponse,
  SubtaskType,
} from './types';

interface Env {
  JIRA_BASE_URL: string;
  JIRA_EMAIL: string;
  JIRA_API_TOKEN: string;
}

/**
 * Create Basic Auth header for Jira API
 * @returns Authorization header value
 */
function getAuthHeader(env: Env): string {
  const credentials = btoa(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`);
  return `Basic ${credentials}`;
}

/**
 * Convert Markdown text to Jira ADF (Atlassian Document Format)
 */
function markdownToADF(markdown: string): any {
  const content: any[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Handle code blocks
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3) || 'plaintext';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      content.push({
        type: 'codeBlock',
        attrs: { language },
        content: [{ type: 'text', text: codeLines.join('\n') }]
      });
      continue;
    }

    // Handle headers
    if (line.startsWith('**') && line.endsWith('**') && !line.includes(':**')) {
      // Bold line acting as header
      content.push({
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: line.replace(/\*\*/g, '').trim() }]
      });
      i++;
      continue;
    }

    // Handle bullet points
    if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
      const listItems: any[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('- '))) {
        const itemText = lines[i].trim().slice(2);
        listItems.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: parseInlineFormatting(itemText)
          }]
        });
        i++;
      }
      content.push({
        type: 'bulletList',
        content: listItems
      });
      continue;
    }

    // Handle numbered lists
    if (/^\d+\.\s/.test(line.trim())) {
      const listItems: any[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
        listItems.push({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: parseInlineFormatting(itemText)
          }]
        });
        i++;
      }
      content.push({
        type: 'orderedList',
        content: listItems
      });
      continue;
    }

    // Regular paragraph
    content.push({
      type: 'paragraph',
      content: parseInlineFormatting(line)
    });
    i++;
  }

  return {
    type: 'doc',
    version: 1,
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
  };
}

/**
 * Parse inline formatting (bold, italic, code)
 */
function parseInlineFormatting(text: string): any[] {
  const result: any[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Handle inline code `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      result.push({
        type: 'text',
        text: codeMatch[1],
        marks: [{ type: 'code' }]
      });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Handle bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      result.push({
        type: 'text',
        text: boldMatch[1],
        marks: [{ type: 'strong' }]
      });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Handle italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      result.push({
        type: 'text',
        text: italicMatch[1],
        marks: [{ type: 'em' }]
      });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Find next special character
    const nextSpecial = remaining.search(/[`*]/);
    if (nextSpecial === -1) {
      // No more special characters
      if (remaining.length > 0) {
        result.push({ type: 'text', text: remaining });
      }
      break;
    } else if (nextSpecial === 0) {
      // Special char at start but didn't match patterns - treat as regular text
      result.push({ type: 'text', text: remaining[0] });
      remaining = remaining.slice(1);
    } else {
      // Add text before special character
      result.push({ type: 'text', text: remaining.slice(0, nextSpecial) });
      remaining = remaining.slice(nextSpecial);
    }
  }

  return result.length > 0 ? result : [{ type: 'text', text: '' }];
}

/**
 * Fetch full issue details from Jira
 * @param issueKey - Jira issue key (e.g., PROJ-123)
 * @param env - Environment variables
 * @returns Complete Jira issue object
 */
export async function getIssue(issueKey: string, env: Env): Promise<JiraIssue> {
  try {
    const url = `${env.JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(env),
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch issue ${issueKey}: ${response.status} ${errorText}`
      );
    }

    const issue = await response.json();
    console.log(`Successfully fetched issue: ${issueKey}`);
    return issue as JiraIssue;
  } catch (error) {
    console.error(`Error fetching issue ${issueKey}:`, error);
    throw error;
  }
}

/**
 * Get existing subtasks for a parent issue
 * @param issueKey - Parent issue key
 * @param env - Environment variables
 * @returns Array of subtask issues
 */
export async function getSubtasks(issueKey: string, env: Env): Promise<any[]> {
  try {
    const issue = await getIssue(issueKey, env);
    return issue.fields.subtasks || [];
  } catch (error) {
    console.error(`Error fetching subtasks for ${issueKey}:`, error);
    throw error;
  }
}

/**
 * Create a new subtask under a parent issue
 * @param parentKey - Parent issue key
 * @param subtaskData - Subtask input data
 * @param env - Environment variables
 * @returns Created subtask response with key and ID
 */
export async function createSubtask(
  parentKey: string,
  subtaskData: SubtaskInput,
  env: Env
): Promise<CreateSubtaskResponse> {
  try {
    // Get parent issue to extract project key
    const parentIssue = await getIssue(parentKey, env);
    const projectKey = parentKey.split('-')[0];

    // Construct subtask creation payload - convert markdown description to ADF
    const payload = {
      fields: {
        project: {
          key: projectKey,
        },
        parent: {
          key: parentKey,
        },
        summary: subtaskData.summary,
        description: markdownToADF(subtaskData.description),
        issuetype: {
          name: 'Subtask', // Standard Jira subtask type
        },
        labels: subtaskData.labels,
      },
    };

    const url = `${env.JIRA_BASE_URL}/rest/api/3/issue`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(env),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to create subtask: ${response.status} ${errorText}`
      );
    }

    const result = (await response.json()) as CreateSubtaskResponse;
    console.log(
      `Successfully created ${subtaskData.subtaskType} subtask: ${result.key}`
    );
    return result;
  } catch (error) {
    console.error('Error creating subtask:', error);
    throw error;
  }
}

/**
 * Update issue description with AI-generated content
 * @param issueKey - Issue key to update
 * @param description - New description content (Markdown)
 * @param env - Environment variables
 */
export async function updateIssueDescription(
  issueKey: string,
  description: string,
  env: Env
): Promise<void> {
  try {
    // Convert Markdown to Jira ADF format
    const adfDescription = markdownToADF(description);

    const payload = {
      fields: {
        description: adfDescription,
      },
    };

    const url = `${env.JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: getAuthHeader(env),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to update issue ${issueKey}: ${response.status} ${errorText}`
      );
    }

    console.log(`Successfully updated description for issue: ${issueKey}`);
  } catch (error) {
    console.error(`Error updating issue ${issueKey}:`, error);
    throw error;
  }
}

/**
 * Check if subtasks with specific labels already exist
 * Used for idempotency
 * @param parentKey - Parent issue key
 * @param subtaskType - Type of subtask to check
 * @param env - Environment variables
 * @returns true if subtask already exists, false otherwise
 */
export async function subtaskExists(
  parentKey: string,
  subtaskType: SubtaskType,
  env: Env
): Promise<boolean> {
  try {
    const subtasks = await getSubtasks(parentKey, env);
    const label =
      subtaskType === SubtaskType.BACKEND ? 'backend' : 'frontend';

    // Check if any subtask has the auto-generated label and type-specific label
    return subtasks.some(
      (subtask) =>
        subtask.fields.labels?.includes('auto-generated') &&
        subtask.fields.labels?.includes(label)
    );
  } catch (error) {
    console.error(`Error checking subtask existence for ${parentKey}:`, error);
    return false;
  }
}
