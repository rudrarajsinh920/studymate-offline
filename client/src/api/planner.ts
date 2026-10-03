import { 
  StudyPlanRecord, 
  StudyPlanWithSessions, 
  StudySessionRecord, 
  CreatePlanRequest, 
  UpdateSessionRequest 
} from 'studymate-shared';

export async function createStudyPlan(req: CreatePlanRequest): Promise<StudyPlanWithSessions> {
  const response = await fetch('/api/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create plan (${response.status})`);
  }

  return response.json();
}

export async function getStudyPlans(): Promise<StudyPlanRecord[]> {
  const response = await fetch('/api/plans');
  if (!response.ok) {
    throw new Error('Failed to fetch study plans');
  }
  return response.json();
}

export async function getStudyPlan(planId: string): Promise<StudyPlanWithSessions> {
  const response = await fetch(`/api/plans/${planId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch study plan ${planId}`);
  }
  return response.json();
}

export async function deleteStudyPlan(planId: string): Promise<void> {
  const response = await fetch(`/api/plans/${planId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete study plan');
  }
}

export async function updateStudySession(
  sessionId: string,
  req: UpdateSessionRequest
): Promise<StudySessionRecord> {
  const response = await fetch(`/api/plans/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    throw new Error('Failed to update study session');
  }

  return response.json();
}

export async function toggleSessionCompletion(
  sessionId: string,
  isCompleted?: boolean
): Promise<StudySessionRecord> {
  const response = await fetch(`/api/plans/sessions/${sessionId}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isCompleted }),
  });

  if (!response.ok) {
    throw new Error('Failed to toggle session status');
  }

  return response.json();
}

export async function deleteStudySession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/plans/sessions/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete study session');
  }
}
