/**
 * Subtask description templates for backend and frontend tasks
 */

import { SubtaskType } from './types';

/**
 * Backend subtask template
 */
export const BACKEND_TEMPLATE = `Goal:
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
- Integration tests`;

/**
 * Frontend subtask template
 */
export const FRONTEND_TEMPLATE = `Goal:
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
[Any UI flow or edge cases]`;

/**
 * Get template by subtask type
 * @param type - SubtaskType enum value
 * @returns Template string
 */
export function getTemplate(type: SubtaskType): string {
  switch (type) {
    case SubtaskType.BACKEND:
      return BACKEND_TEMPLATE;
    case SubtaskType.FRONTEND:
      return FRONTEND_TEMPLATE;
    default:
      throw new Error(`Unknown subtask type: ${type}`);
  }
}
