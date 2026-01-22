/**
 * Jira REST API helper functions
 */

import {
  JiraIssue,
  SubtaskInput,
  CreateSubtaskResponse,
  SubtaskType,
} from './types';

// Get configuration from environment variables
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';

/**
 * Create Basic Auth header for Jira API
 * @returns Authorization header value
 */
function getAuthHeader(): string {
  const credentials = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString(
    'base64'
  );
  return `Basic ${credentials}`;
}

/**
 * Fetch full issue details from Jira
 * @param issueKey - Jira issue key (e.g., PROJ-123)
 * @returns Complete Jira issue object
 */
export async function getIssue(issueKey: string): Promise<JiraIssue> {
  try {
    const url = `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: getAuthHeader(),
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
 * @returns Array of subtask issues
 */
export async function getSubtasks(issueKey: string): Promise<any[]> {
  try {
    const issue = await getIssue(issueKey);
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
 * @returns Created subtask response with key and ID
 */
export async function createSubtask(
  parentKey: string,
  subtaskData: SubtaskInput
): Promise<CreateSubtaskResponse> {
  try {
    // Get parent issue to extract project key
    const parentIssue = await getIssue(parentKey);
    const projectKey = parentKey.split('-')[0];

    // Construct subtask creation payload
    const payload = {
      fields: {
        project: {
          key: projectKey,
        },
        parent: {
          key: parentKey,
        },
        summary: subtaskData.summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: subtaskData.description,
                },
              ],
            },
          ],
        },
        issuetype: {
          name: 'Subtask', // Standard Jira subtask type
        },
        labels: subtaskData.labels,
      },
    };

    const url = `${JIRA_BASE_URL}/rest/api/3/issue`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
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
 * @param description - New description content
 */
export async function updateIssueDescription(
  issueKey: string,
  description: string
): Promise<void> {
  try {
    // Format description for Jira Document Format
    const payload = {
      fields: {
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: description,
                },
              ],
            },
          ],
        },
      },
    };

    const url = `${JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: getAuthHeader(),
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
 * @returns true if subtask already exists, false otherwise
 */
export async function subtaskExists(
  parentKey: string,
  subtaskType: SubtaskType
): Promise<boolean> {
  try {
    const subtasks = await getSubtasks(parentKey);
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
