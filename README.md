# Jira Subtask Automation Service

A Cloudflare Worker that automatically generates backend and frontend subtasks from Jira Stories using Google Gemini AI.

## Overview

When a Jira Story moves to "Ready to Start", this service:
1. Receives a webhook from Jira Automation
2. Extracts story details and acceptance criteria
3. Uses Gemini AI to generate structured implementation descriptions
4. Creates Backend and Frontend subtasks with AI-generated content

## Project Structure

```
/src/index.ts        # Main worker entry point
/lib
  /jira.ts           # Jira API helpers + Markdown to ADF converter
  /openai.ts         # Gemini AI integration
  /types.ts          # TypeScript interfaces
  /validation.ts     # Webhook signature validation
```

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account
- Jira Cloud instance
- Google Gemini API key (free at https://aistudio.google.com/app/apikey)

### Deploy

```bash
npm install

# Login to Cloudflare
npx wrangler login

# Add secrets
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put JIRA_BASE_URL      # e.g., https://your-domain.atlassian.net
npx wrangler secret put JIRA_EMAIL
npx wrangler secret put JIRA_API_TOKEN
npx wrangler secret put WEBHOOK_SECRET

# Deploy
npm run deploy
```

## Jira Automation Setup

Create an Automation Rule in your Jira project:

**Trigger:** Issue transitioned → To status: "Ready to Start" (or your target status)

**Condition:** Issue Type equals Story

**Action:** Send web request
- URL: `https://board-helper.<your-subdomain>.workers.dev/api/jira-webhook`
- Method: POST
- Body (Custom data):

```json
{
  "webhookEvent": "jira:issue_updated",
  "issue": {
    "id": "{{issue.id}}",
    "key": "{{issue.key}}",
    "fields": {
      "summary": "{{issue.summary}}",
      "description": "{{issue.description}}",
      "status": { "name": "{{issue.status.name}}" },
      "issuetype": { "name": "{{issue.type.name}}" },
      "labels": {{issue.labels}},
      "components": {{issue.components}}
    }
  },
  "changelog": {
    "items": [{
      "field": "status",
      "fromString": "{{changelog.status.fromString}}",
      "toString": "{{changelog.status.toString}}"
    }]
  }
}
```

## Configuration

Set `JIRA_READY_STATUS` in `wrangler.toml` to customize the trigger status:

```toml
[vars]
JIRA_READY_STATUS = "Ready to Start"
```

## Troubleshooting

**View logs:**
```bash
npx wrangler tail
```

**Check secrets:**
```bash
npx wrangler secret list
```

**Common issues:**
- Ensure JIRA_BASE_URL has no trailing slash
- Verify Jira API token has project permissions
- Check Gemini API quota at https://ai.dev/rate-limit

## Idempotency

Subtasks with labels `auto-generated` + `backend`/`frontend` are checked before creation to prevent duplicates.

## License

MIT
