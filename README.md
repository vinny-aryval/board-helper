# Jira Subtask Automation Service

A serverless Node.js service deployed on Vercel that integrates Jira Automation, OpenAI, and Jira REST API to automatically generate backend and frontend implementation subtasks from a Jira Story.

## 🎯 Overview

When a Jira Story moves to "Ready for Dev", this service:
1. Receives a webhook notification from Jira
2. Fetches the complete Story details
3. Uses OpenAI to generate structured implementation descriptions
4. Creates (or updates) Backend and Frontend subtasks
5. Populates subtasks with AI-generated, engineer-editable content

## 🏗️ Architecture

```
Jira Story (Ready for Dev)
    ↓
Jira Automation Rule
    ↓
Webhook → Vercel Function
    ↓
├─ Validate Signature
├─ Fetch Story Details
├─ Check Existing Subtasks
├─ Create Subtasks
└─ Generate AI Content
    ↓
Updated Jira Subtasks
```

## 📁 Project Structure

```
/api
  /jira-webhook.ts       # Main webhook handler
/lib
  /jira.ts               # Jira API helper functions
  /openai.ts             # AI prompt builders and API calls
  /templates.ts          # Subtask description templates
  /types.ts              # TypeScript interfaces
  /validation.ts         # Webhook signature validation
/package.json
/tsconfig.json
/vercel.json
/.env.example
/.gitignore
/README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Vercel account
- Jira Cloud instance with admin access
- OpenAI API key

### 1. Clone and Install

```bash
git clone <repository-url>
cd board-playground
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here

# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token-here

# Optional: Custom status name that triggers subtask creation (default: "Ready for Dev")
# JIRA_READY_STATUS=Ready for Dev

# Webhook Security
WEBHOOK_SECRET=your-webhook-secret-here
```

#### Getting Credentials

**Jira API Token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a label (e.g., "Vercel Automation")
4. Copy the token

**OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key

**Webhook Secret:**
- Generate a random secret (e.g., using `openssl rand -hex 32`)
- This will be used to validate webhook requests

### 3. Test Locally

```bash
npm run dev
```

This starts a local Vercel dev server at `http://localhost:3000`.

### 4. Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Option B: Using Vercel GitHub Integration

1. Push your code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Deploy

### 5. Configure Environment Variables in Vercel

After deployment, add your environment variables:

1. Go to your project in Vercel Dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable:
   - `OPENAI_API_KEY`
   - `JIRA_BASE_URL`
   - `JIRA_EMAIL`
   - `JIRA_API_TOKEN`
   - `WEBHOOK_SECRET`
   - `JIRA_READY_STATUS` (optional, defaults to "Ready for Dev")
4. Redeploy to apply changes

## 🔗 Jira Configuration

### Step 1: Create Webhook in Jira

1. Go to **Jira Settings** → **System** → **Webhooks**
2. Click **Create a Webhook**
3. Configure:
   - **Name**: Subtask Automation
   - **Status**: Enabled
   - **URL**: `https://your-vercel-app.vercel.app/api/jira-webhook`
   - **Events**: Issue → updated

4. **Custom Headers** (Optional):
   - Add `x-hub-signature` header if using signature validation
   - Value will be computed by Jira Automation Rule

5. Click **Create**

### Step 2: Configure Jira Automation Rule

1. Go to **Project Settings** → **Automation**
2. Click **Create Rule**
3. Configure the rule:

**Trigger:**
- **Type**: Issue transitioned
- **From status**: Any status
- **To status**: Ready for Dev
- **Issue type**: Story

**Condition:**
- **Type**: Issue fields condition
- **Field**: Issue Type
- **Condition**: equals
- **Value**: Story

**Action:**
- **Type**: Send web request
- **Webhook URL**: `https://your-vercel-app.vercel.app/api/jira-webhook`
- **HTTP method**: POST
- **Webhook body**: Custom data
- **Custom data**: (Use smart values)

```json
{
  "webhookEvent": "jira:issue_updated",
  "issue": {
    "id": "{{issue.id}}",
    "key": "{{issue.key}}",
    "fields": {
      "summary": "{{issue.summary}}",
      "description": "{{issue.description}}",
      "status": {
        "name": "{{issue.status.name}}"
      },
      "issuetype": {
        "name": "{{issue.type.name}}"
      },
      "labels": {{issue.labels}},
      "components": {{issue.components}}
    }
  },
  "changelog": {
    "items": [
      {
        "field": "status",
        "fromString": "{{changelog.status.fromString}}",
        "toString": "{{changelog.status.toString}}"
      }
    ]
  }
}
```

**Custom Headers:**
- Key: `x-hub-signature`
- Value: Generate HMAC signature (if implementing custom security)

4. **Name the rule**: "Auto-create Backend/Frontend Subtasks"
5. Click **Turn it on**

## 🧪 Testing

### Test the Webhook Endpoint

Using curl:

```bash
curl -X POST https://your-vercel-app.vercel.app/api/jira-webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature: your-signature-here" \
  -d '{
    "webhookEvent": "jira:issue_updated",
    "issue": {
      "id": "10001",
      "key": "PROJ-123",
      "fields": {
        "summary": "User Registration API",
        "description": "Implement user registration endpoint",
        "status": { "name": "Ready for Dev" },
        "issuetype": { "name": "Story" }
      }
    },
    "changelog": {
      "items": [
        {
          "field": "status",
          "fromString": "To Do",
          "toString": "Ready for Dev"
        }
      ]
    }
  }'
```

### Test in Jira

1. Create a Story in your Jira project
2. Add a description with acceptance criteria
3. Move the Story to "Ready for Dev" status
4. Check Vercel logs for processing
5. Verify subtasks are created in Jira

## 📋 Subtask Templates

### Backend Subtask Template

```
Goal:
[Brief purpose of the endpoint]

Fields Required:
[List of fields inferred from story + design]

Business Logic:
[Rule 1]
[Rule 2]
[Rule 3]

Technical Implementation Details:
Endpoint:
Method:
Request Body:
Response:

Validation & Errors:
[List]

Tests:
- Unit tests
- Integration tests
```

### Frontend Subtask Template

```
Goal:
Integrate UI with backend endpoint

Design:
[Figma link]

Endpoint:
[Reference to backend subtask]

Acceptance Criteria:
- Validations aligned with backend
- Loading states handled
- Errors handled gracefully
- E2E test added

Notes:
[Any UI flow or edge cases]
```

## 🔒 Security

- **HTTPS**: All communication is encrypted
- **Webhook Validation**: HMAC-SHA256 signature verification using Node.js built-in `timingSafeEqual`
  - Note: For production with strict signature validation, you may need to configure Vercel to provide raw request body access
  - Current implementation validates the JSON-stringified body as a basic security check
- **API Keys**: Stored securely as environment variables
- **Least Privilege**: Jira API token has minimal required permissions

## 🐛 Troubleshooting

### Subtasks Not Being Created

1. **Check Vercel Logs**:
   ```bash
   vercel logs <deployment-url>
   ```

2. **Verify Environment Variables**:
   - Ensure all variables are set in Vercel
   - Check JIRA_BASE_URL doesn't have trailing slash

3. **Check Jira Automation Rule**:
   - Ensure rule is enabled
   - Check execution history in Jira

4. **Validate Webhook Signature**:
   - Temporarily disable signature validation for testing
   - Check `x-hub-signature` header is being sent

### OpenAI API Errors

- **Rate Limit**: Check your OpenAI usage and limits
- **Invalid API Key**: Verify `OPENAI_API_KEY` is correct
- **Model Access**: Ensure you have access to GPT-4

### Jira API Errors

- **Authentication Failed**: Verify `JIRA_EMAIL` and `JIRA_API_TOKEN`
- **Permission Denied**: Ensure API token has project permissions
- **Invalid Project Key**: Check project key format in `JIRA_BASE_URL`

## 🔧 Development

### Type Checking

```bash
npm run type-check
```

### Local Development

```bash
npm run dev
```

The webhook will be available at `http://localhost:3000/api/jira-webhook`.

## 📊 Monitoring

### Vercel Dashboard

- View deployment logs
- Monitor function invocations
- Track errors and performance

### Jira Audit Log

- Go to **Jira Settings** → **System** → **Audit Log**
- Filter by "API token usage"

## 🚦 Idempotency

The service checks if subtasks with `auto-generated`, `backend`, and `frontend` labels already exist before creating new ones. This prevents duplicate subtasks if the webhook is triggered multiple times.

## 🛠️ Extending the Service

### Adding New Subtask Types

1. Add new type to `SubtaskType` enum in `lib/types.ts`
2. Create template in `lib/templates.ts`
3. Add generation function in `lib/openai.ts`
4. Update webhook handler to create new subtask type

### Customizing AI Prompts

Edit the templates in `lib/templates.ts` and prompt builders in `lib/openai.ts`.

### Adding Custom Fields

Update `extractStoryContext()` in `api/jira-webhook.ts` to extract additional Jira fields.

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 📞 Support

For issues and questions:
- Check the Troubleshooting section
- Review Vercel and Jira logs
- Open a GitHub issue
- Test