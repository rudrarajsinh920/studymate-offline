import { randomUUID } from 'crypto';
import { 
  StudyPlanRecord, 
  StudySessionRecord, 
  StudyPlanWithSessions, 
  CreatePlanRequest, 
  UpdateSessionRequest, 
  PriorityLevel 
} from 'studymate-shared';
import { plannerRepository } from '../../db/repositories/plannerRepository';
import { documentRepository } from '../../db/repositories/documentRepository';

export class PlannerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlannerValidationError';
  }
}

export class PlannerService {
  /**
   * Helper to format a Date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Generates a realistic, deterministic study schedule tailored to student constraints.
   */
  public generatePlan(req: CreatePlanRequest): StudyPlanWithSessions {
    // 1. Validate Exam Date
    if (!req.examDate || typeof req.examDate !== 'string') {
      throw new PlannerValidationError('Exam date is required in YYYY-MM-DD format.');
    }

    const examDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(req.examDate.trim());
    if (!examDateMatch) {
      throw new PlannerValidationError('Exam date must be in YYYY-MM-DD format.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = this.formatDate(today);

    if (req.examDate < todayStr) {
      throw new PlannerValidationError(`Exam date (${req.examDate}) cannot be in the past. Today is ${todayStr}.`);
    }

    // 2. Validate Available Hours per Day
    const dailyHours = Number(req.dailyAvailableHours);
    if (isNaN(dailyHours) || dailyHours <= 0 || dailyHours > 16) {
      throw new PlannerValidationError('Available study hours per day must be between 0.5 and 16 hours.');
    }

    const maxDailyMinutes = Math.floor(dailyHours * 60);

    // 3. Validate Session Duration
    let preferredDuration = Number(req.preferredSessionMinutes || 45);
    if (isNaN(preferredDuration) || preferredDuration < 15 || preferredDuration > 240) {
      preferredDuration = 45;
    }
    // Cap session duration to daily available minutes
    if (preferredDuration > maxDailyMinutes) {
      preferredDuration = maxDailyMinutes;
    }

    // 4. Resolve Target Topics
    let topics = (req.topics || []).map((t) => t.trim()).filter(Boolean);
    const difficultSet = new Set((req.difficultTopics || []).map((t) => t.trim().toLowerCase()));

    // If no topics provided, check documentIds or available documents
    const docIds = req.documentIds || [];
    if (topics.length === 0) {
      if (docIds.length > 0) {
        for (const id of docIds) {
          const doc = documentRepository.getById(id);
          if (doc) {
            // Clean filename without extension as topic name
            const cleanName = doc.filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
            topics.push(cleanName);
          }
        }
      } else {
        const allDocs = documentRepository.listSummaries();
        for (const doc of allDocs) {
          if (doc.status === 'ready') {
            const cleanName = doc.filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
            topics.push(cleanName);
          }
        }
      }
    }

    if (topics.length === 0) {
      throw new PlannerValidationError(
        'Please provide at least one topic or upload course documents to generate a study plan.'
      );
    }

    // Deduplicate topics
    topics = Array.from(new Set(topics));

    // 5. Calculate calendar days between today and exam date
    const [eYear, eMonth, eDay] = req.examDate.split('-').map(Number);
    const targetExamDate = new Date(eYear, eMonth - 1, eDay);
    targetExamDate.setHours(0, 0, 0, 0);

    const availableDateStrings: string[] = [];
    const curr = new Date(today.getTime());

    while (curr <= targetExamDate) {
      availableDateStrings.push(this.formatDate(curr));
      curr.setDate(curr.getDate() + 1);
    }

    if (availableDateStrings.length === 0) {
      throw new PlannerValidationError('No available study days remaining before the exam date.');
    }

    // 6. Generate planned task items
    interface CandidateSession {
      title: string;
      topic: string;
      durationMinutes: number;
      priority: PriorityLevel;
      documentId?: string;
    }

    const candidateSessions: CandidateSession[] = [];

    // Prioritize difficult topics with extra focus sessions
    for (const topic of topics) {
      const isDifficult = difficultSet.has(topic.toLowerCase());

      if (isDifficult) {
        candidateSessions.push({
          title: `Foundations & Deep Dive: ${topic}`,
          topic,
          durationMinutes: preferredDuration,
          priority: 'high',
        });
        candidateSessions.push({
          title: `Practice & Problem Solving: ${topic}`,
          topic,
          durationMinutes: preferredDuration,
          priority: 'high',
        });
        candidateSessions.push({
          title: `Active Recall & Self-Testing: ${topic}`,
          topic,
          durationMinutes: preferredDuration,
          priority: 'high',
        });
      } else {
        candidateSessions.push({
          title: `Core Concepts: ${topic}`,
          topic,
          durationMinutes: preferredDuration,
          priority: 'medium',
        });
        candidateSessions.push({
          title: `Review & High-Yield Summary: ${topic}`,
          topic,
          durationMinutes: preferredDuration,
          priority: 'medium',
        });
      }
    }

    // Add final review session for exam day / eve
    candidateSessions.push({
      title: 'Comprehensive Review & Exam Readiness',
      topic: 'Final Exam Preparation',
      durationMinutes: preferredDuration,
      priority: 'high',
    });

    // 7. Deterministically distribute sessions across available days without exceeding daily hours
    const dailyUsageMinutes: Record<string, number> = {};
    for (const d of availableDateStrings) {
      dailyUsageMinutes[d] = 0;
    }

    const scheduledSessions: StudySessionRecord[] = [];
    const planId = randomUUID();

    let dayIndex = 0;
    for (const candidate of candidateSessions) {
      // Find the next day that has enough room for this session
      let placed = false;
      let attempts = 0;

      while (attempts < availableDateStrings.length) {
        const currentDateStr = availableDateStrings[dayIndex];
        const currentDailyUsed = dailyUsageMinutes[currentDateStr] || 0;

        if (currentDailyUsed + candidate.durationMinutes <= maxDailyMinutes) {
          scheduledSessions.push({
            id: randomUUID(),
            plan_id: planId,
            title: candidate.title,
            topic: candidate.topic,
            planned_date: currentDateStr,
            duration_minutes: candidate.durationMinutes,
            priority: candidate.priority,
            is_completed: false,
            completed_at: null,
            document_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          dailyUsageMinutes[currentDateStr] = currentDailyUsed + candidate.durationMinutes;
          placed = true;
          // Advance dayIndex in round-robin fashion so tasks spread evenly
          dayIndex = (dayIndex + 1) % availableDateStrings.length;
          break;
        }

        dayIndex = (dayIndex + 1) % availableDateStrings.length;
        attempts++;
      }

      if (!placed) {
        // If all days have reached maxDailyMinutes, we do not schedule beyond daily capacity
        // This guarantees: "Avoid scheduling more time than the student makes available."
        break;
      }
    }

    // 8. Create Plan Record
    const planRecord: StudyPlanRecord = {
      id: planId,
      title: (req.title || `Study Plan for Exam (${req.examDate})`).trim(),
      exam_date: req.examDate,
      daily_available_hours: dailyHours,
      preferred_session_minutes: preferredDuration,
      target_topics: topics,
      difficult_topics: Array.from(difficultSet),
      document_ids: docIds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 9. Persist in SQLite
    return plannerRepository.createPlanWithSessions(planRecord, scheduledSessions);
  }

  public listPlans(): StudyPlanRecord[] {
    return plannerRepository.listPlans();
  }

  public getPlan(planId: string): StudyPlanWithSessions | null {
    return plannerRepository.getPlanWithSessions(planId);
  }

  public deletePlan(planId: string): boolean {
    return plannerRepository.deletePlan(planId);
  }

  public updateSession(sessionId: string, updates: UpdateSessionRequest): StudySessionRecord | null {
    return plannerRepository.updateSession(sessionId, updates);
  }

  public toggleSessionComplete(sessionId: string, explicitState?: boolean): StudySessionRecord | null {
    return plannerRepository.toggleSessionComplete(sessionId, explicitState);
  }

  public deleteSession(sessionId: string): boolean {
    return plannerRepository.deleteSession(sessionId);
  }
}

export const plannerService = new PlannerService();
