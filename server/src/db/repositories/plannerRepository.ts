import { db } from '../database';
import { 
  StudyPlanRecord, 
  StudySessionRecord, 
  StudyPlanWithSessions, 
  PriorityLevel 
} from 'studymate-shared';

interface DbPlanRow {
  id: string;
  title: string;
  exam_date: string;
  daily_available_hours: number;
  preferred_session_minutes: number;
  target_topics: string | null;
  difficult_topics: string | null;
  document_ids: string | null;
  created_at: string;
  updated_at: string;
}

interface DbSessionRow {
  id: string;
  plan_id: string;
  title: string;
  topic: string;
  planned_date: string;
  duration_minutes: number;
  priority: string;
  is_completed: number;
  completed_at: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
}

function parsePlanRow(row: DbPlanRow): StudyPlanRecord {
  return {
    id: row.id,
    title: row.title,
    exam_date: row.exam_date,
    daily_available_hours: row.daily_available_hours,
    preferred_session_minutes: row.preferred_session_minutes,
    target_topics: row.target_topics ? JSON.parse(row.target_topics) : [],
    difficult_topics: row.difficult_topics ? JSON.parse(row.difficult_topics) : [],
    document_ids: row.document_ids ? JSON.parse(row.document_ids) : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseSessionRow(row: DbSessionRow): StudySessionRecord {
  return {
    id: row.id,
    plan_id: row.plan_id,
    title: row.title,
    topic: row.topic,
    planned_date: row.planned_date,
    duration_minutes: row.duration_minutes,
    priority: row.priority as PriorityLevel,
    is_completed: Boolean(row.is_completed),
    completed_at: row.completed_at,
    document_id: row.document_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const plannerRepository = {
  /**
   * Save a study plan and all its calculated sessions atomically.
   */
  createPlanWithSessions(
    plan: StudyPlanRecord,
    sessions: StudySessionRecord[]
  ): StudyPlanWithSessions {
    const insertPlanStmt = db.prepare(`
      INSERT INTO study_plans (
        id, title, exam_date, daily_available_hours, preferred_session_minutes,
        target_topics, difficult_topics, document_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSessionStmt = db.prepare(`
      INSERT INTO study_sessions (
        id, plan_id, title, topic, planned_date, duration_minutes, priority,
        is_completed, completed_at, document_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      insertPlanStmt.run(
        plan.id,
        plan.title,
        plan.exam_date,
        plan.daily_available_hours,
        plan.preferred_session_minutes,
        JSON.stringify(plan.target_topics || []),
        JSON.stringify(plan.difficult_topics || []),
        JSON.stringify(plan.document_ids || [])
      );

      for (const s of sessions) {
        insertSessionStmt.run(
          s.id,
          s.plan_id,
          s.title,
          s.topic,
          s.planned_date,
          s.duration_minutes,
          s.priority,
          s.is_completed ? 1 : 0,
          s.completed_at || null,
          s.document_id || null
        );
      }
    });

    tx();
    return this.getPlanWithSessions(plan.id)!;
  },

  listPlans(): StudyPlanRecord[] {
    const stmt = db.prepare(`SELECT * FROM study_plans ORDER BY exam_date ASC, created_at DESC`);
    const rows = stmt.all() as DbPlanRow[];
    return rows.map(parsePlanRow);
  },

  getPlanWithSessions(planId: string): StudyPlanWithSessions | null {
    const planRow = db.prepare(`SELECT * FROM study_plans WHERE id = ?`).get(planId) as DbPlanRow | undefined;
    if (!planRow) return null;

    const basePlan = parsePlanRow(planRow);
    const sessionRows = db.prepare(`
      SELECT * FROM study_sessions
      WHERE plan_id = ?
      ORDER BY planned_date ASC, priority DESC, created_at ASC
    `).all(planId) as DbSessionRow[];

    const sessions = sessionRows.map(parseSessionRow);
    const completedSessions = sessions.filter((s) => s.is_completed).length;
    const totalStudyMinutes = sessions.reduce((acc, s) => acc + s.duration_minutes, 0);
    const completedMinutes = sessions.filter((s) => s.is_completed).reduce((acc, s) => acc + s.duration_minutes, 0);

    return {
      ...basePlan,
      sessions,
      totalSessions: sessions.length,
      completedSessions,
      totalStudyMinutes,
      completedMinutes,
    };
  },

  deletePlan(planId: string): boolean {
    const stmt = db.prepare(`DELETE FROM study_plans WHERE id = ?`);
    const res = stmt.run(planId);
    return res.changes > 0;
  },

  getSession(sessionId: string): StudySessionRecord | null {
    const row = db.prepare(`SELECT * FROM study_sessions WHERE id = ?`).get(sessionId) as DbSessionRow | undefined;
    return row ? parseSessionRow(row) : null;
  },

  updateSession(
    sessionId: string,
    updates: Partial<{
      title: string;
      plannedDate: string;
      durationMinutes: number;
      priority: PriorityLevel;
      isCompleted: boolean;
    }>
  ): StudySessionRecord | null {
    const existing = this.getSession(sessionId);
    if (!existing) return null;

    const newTitle = updates.title ?? existing.title;
    const newDate = updates.plannedDate ?? existing.planned_date;
    const newDuration = updates.durationMinutes ?? existing.duration_minutes;
    const newPriority = updates.priority ?? existing.priority;
    const newCompleted = updates.isCompleted !== undefined ? updates.isCompleted : existing.is_completed;
    const completedAt = newCompleted ? (existing.completed_at || new Date().toISOString()) : null;

    db.prepare(`
      UPDATE study_sessions
      SET title = ?,
          planned_date = ?,
          duration_minutes = ?,
          priority = ?,
          is_completed = ?,
          completed_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      newTitle,
      newDate,
      newDuration,
      newPriority,
      newCompleted ? 1 : 0,
      completedAt,
      sessionId
    );

    // Update plan's updated_at
    db.prepare(`UPDATE study_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(existing.plan_id);

    return this.getSession(sessionId);
  },

  toggleSessionComplete(sessionId: string, explicitState?: boolean): StudySessionRecord | null {
    const existing = this.getSession(sessionId);
    if (!existing) return null;

    const nextCompleted = explicitState !== undefined ? explicitState : !existing.is_completed;
    return this.updateSession(sessionId, { isCompleted: nextCompleted });
  },

  deleteSession(sessionId: string): boolean {
    const res = db.prepare(`DELETE FROM study_sessions WHERE id = ?`).run(sessionId);
    return res.changes > 0;
  },
};
