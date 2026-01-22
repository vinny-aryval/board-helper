/**
 * TypeScript type definitions for the Jira subtask automation service
 */

// Enum for subtask types
export enum SubtaskType {
  BACKEND = 'Backend',
  FRONTEND = 'Frontend',
}

// Jira webhook payload structure
export interface JiraWebhookPayload {
  webhookEvent: string;
  issue_event_type_name?: string;
  issue: {
    id: string;
    key: string;
    fields: {
      summary: string;
      description?: any;
      status: {
        name: string;
      };
      issuetype: {
        name: string;
      };
      labels?: string[];
      components?: Array<{ name: string }>;
    };
  };
  changelog?: {
    items: Array<{
      field: string;
      fromString: string;
      toString: string;
    }>;
  };
}

// Complete Jira issue structure
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: any;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
      subtask: boolean;
    };
    labels?: string[];
    components?: Array<{ name: string }>;
    subtasks?: Array<{
      id: string;
      key: string;
      fields: {
        summary: string;
        issuetype: {
          name: string;
        };
        labels?: string[];
      };
    }>;
    customfield_10037?: string; // Common field for Figma links (adjust as needed)
  };
}

// Story context extracted for AI processing
export interface StoryContext {
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria?: string;
  figmaLink?: string;
  labels: string[];
  components: string[];
}

// Input data for creating a subtask
export interface SubtaskInput {
  summary: string;
  description: string;
  subtaskType: SubtaskType;
  labels: string[];
}

// Response from creating a subtask
export interface CreateSubtaskResponse {
  id: string;
  key: string;
  self: string;
}

// OpenAI API response structure
export interface AIGeneratedDescription {
  content: string;
  tokenUsage?: number;
}

// Configuration for environment variables
export interface Config {
  openaiApiKey: string;
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  webhookSecret: string;
}
