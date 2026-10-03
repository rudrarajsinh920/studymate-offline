import { 
  QuizRecord, 
  QuizWithQuestions, 
  GenerateQuizRequest, 
  SubmitQuizAttemptRequest, 
  SubmitQuizAttemptResponse, 
  QuizAttemptRecord 
} from 'studymate-shared';

export class QuizApiError extends Error {
  public code?: string;
  public instructions?: string;

  constructor(message: string, code?: string, instructions?: string) {
    super(message);
    this.name = 'QuizApiError';
    this.code = code;
    this.instructions = instructions;
  }
}

export async function generateQuiz(req: GenerateQuizRequest): Promise<QuizWithQuestions> {
  const response = await fetch('/api/quizzes/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `Failed to generate quiz (${response.status})`;
    throw new QuizApiError(message, errorData.code, errorData.instructions);
  }

  return response.json();
}

export async function getQuizzes(): Promise<QuizRecord[]> {
  const response = await fetch('/api/quizzes');
  if (!response.ok) {
    throw new Error('Failed to fetch quizzes');
  }
  return response.json();
}

export async function getQuiz(quizId: string): Promise<QuizWithQuestions> {
  const response = await fetch(`/api/quizzes/${quizId}`);
  if (!response.ok) {
    throw new Error(`Failed to load quiz ${quizId}`);
  }
  return response.json();
}

export async function deleteQuiz(quizId: string): Promise<void> {
  const response = await fetch(`/api/quizzes/${quizId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete quiz');
  }
}

export async function submitQuizAttempt(
  quizId: string,
  req: SubmitQuizAttemptRequest
): Promise<SubmitQuizAttemptResponse> {
  const response = await fetch(`/api/quizzes/${quizId}/attempt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to submit quiz attempt');
  }

  return response.json();
}

export async function getQuizAttempts(quizId: string): Promise<QuizAttemptRecord[]> {
  const response = await fetch(`/api/quizzes/${quizId}/attempts`);
  if (!response.ok) {
    throw new Error('Failed to fetch quiz attempts');
  }
  return response.json();
}
