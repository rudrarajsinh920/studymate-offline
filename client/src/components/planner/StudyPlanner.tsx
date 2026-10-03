import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Flame,
  X
} from 'lucide-react';
import { 
  StudyPlanRecord, 
  StudyPlanWithSessions, 
  StudySessionRecord, 
  PriorityLevel 
} from 'studymate-shared';
import { 
  createStudyPlan, 
  getStudyPlans, 
  getStudyPlan, 
  deleteStudyPlan, 
  toggleSessionCompletion, 
  updateStudySession, 
  deleteStudySession 
} from '../../api/planner';
import { DocumentSummary } from '../../api/documents';

interface StudyPlannerProps {
  documents: DocumentSummary[];
}

export const StudyPlanner: React.FC<StudyPlannerProps> = ({ documents }) => {
  const [plans, setPlans] = useState<StudyPlanRecord[]>([]);
  const [activePlan, setActivePlan] = useState<StudyPlanWithSessions | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State for New Plan
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [planTitle, setPlanTitle] = useState<string>('');
  const [examDate, setExamDate] = useState<string>('');
  const [dailyHours, setDailyHours] = useState<number>(2);
  const [preferredMinutes, setPreferredMinutes] = useState<number>(45);
  const [customTopics, setCustomTopics] = useState<string>('');
  const [difficultTopics, setDifficultTopics] = useState<string>('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Session Edit Modal State
  const [editingSession, setEditingSession] = useState<StudySessionRecord | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDuration, setEditDuration] = useState<number>(45);
  const [editDate, setEditDate] = useState<string>('');
  const [editPriority, setEditPriority] = useState<PriorityLevel>('medium');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const list = await getStudyPlans();
      setPlans(list);
      if (list.length > 0) {
        const fullPlan = await getStudyPlan(list[0].id);
        setActivePlan(fullPlan);
      } else {
        setActivePlan(null);
      }
    } catch (err) {
      console.error('Failed to load study plans:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load study plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (id: string) => {
    try {
      const fullPlan = await getStudyPlan(id);
      setActivePlan(fullPlan);
    } catch (err) {
      console.error('Failed to load plan details:', err);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErrorMessage(null);

    try {
      const parsedTopics = customTopics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const parsedDifficult = difficultTopics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const newPlan = await createStudyPlan({
        title: planTitle.trim() || undefined,
        examDate,
        dailyAvailableHours: Number(dailyHours),
        preferredSessionMinutes: Number(preferredMinutes),
        topics: parsedTopics.length > 0 ? parsedTopics : undefined,
        difficultTopics: parsedDifficult.length > 0 ? parsedDifficult : undefined,
        documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
      });

      setPlans((prev) => [newPlan, ...prev.filter((p) => p.id !== newPlan.id)]);
      setActivePlan(newPlan);
      setShowCreateModal(false);

      // Reset form
      setPlanTitle('');
      setExamDate('');
      setCustomTopics('');
      setDifficultTopics('');
      setSelectedDocIds([]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlan = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this study plan?')) return;

    try {
      await deleteStudyPlan(id);
      const remaining = plans.filter((p) => p.id !== id);
      setPlans(remaining);
      if (activePlan?.id === id) {
        if (remaining.length > 0) {
          handleSelectPlan(remaining[0].id);
        } else {
          setActivePlan(null);
        }
      }
    } catch (err) {
      alert('Failed to delete study plan');
    }
  };

  const handleToggleSession = async (session: StudySessionRecord) => {
    if (!activePlan) return;
    try {
      const updated = await toggleSessionCompletion(session.id);
      setActivePlan((prev) => {
        if (!prev) return null;
        const newSessions = prev.sessions.map((s) => (s.id === session.id ? updated : s));
        const completedSessions = newSessions.filter((s) => s.is_completed).length;
        const completedMinutes = newSessions
          .filter((s) => s.is_completed)
          .reduce((acc, s) => acc + s.duration_minutes, 0);

        return {
          ...prev,
          sessions: newSessions,
          completedSessions,
          completedMinutes,
        };
      });
    } catch (err) {
      alert('Failed to toggle session');
    }
  };

  const handleOpenEditSession = (session: StudySessionRecord) => {
    setEditingSession(session);
    setEditTitle(session.title);
    setEditDuration(session.duration_minutes);
    setEditDate(session.planned_date);
    setEditPriority(session.priority);
  };

  const handleSaveEditSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession || !activePlan) return;

    try {
      const updated = await updateStudySession(editingSession.id, {
        title: editTitle.trim(),
        durationMinutes: Number(editDuration),
        plannedDate: editDate,
        priority: editPriority,
      });

      setActivePlan((prev) => {
        if (!prev) return null;
        const newSessions = prev.sessions.map((s) => (s.id === editingSession.id ? updated : s));
        const totalStudyMinutes = newSessions.reduce((acc, s) => acc + s.duration_minutes, 0);
        const completedMinutes = newSessions
          .filter((s) => s.is_completed)
          .reduce((acc, s) => acc + s.duration_minutes, 0);

        return {
          ...prev,
          sessions: newSessions,
          totalStudyMinutes,
          completedMinutes,
        };
      });

      setEditingSession(null);
    } catch (err) {
      alert('Failed to update session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Delete this study session?')) return;
    try {
      await deleteStudySession(sessionId);
      setActivePlan((prev) => {
        if (!prev) return null;
        const newSessions = prev.sessions.filter((s) => s.id !== sessionId);
        const totalSessions = newSessions.length;
        const completedSessions = newSessions.filter((s) => s.is_completed).length;
        const totalStudyMinutes = newSessions.reduce((acc, s) => acc + s.duration_minutes, 0);
        const completedMinutes = newSessions
          .filter((s) => s.is_completed)
          .reduce((acc, s) => acc + s.duration_minutes, 0);

        return {
          ...prev,
          sessions: newSessions,
          totalSessions,
          completedSessions,
          totalStudyMinutes,
          completedMinutes,
        };
      });
    } catch (err) {
      alert('Failed to delete session');
    }
  };

  // Group active plan sessions by planned date
  const sessionsByDate: Record<string, StudySessionRecord[]> = {};
  if (activePlan) {
    for (const session of activePlan.sessions) {
      if (!sessionsByDate[session.planned_date]) {
        sessionsByDate[session.planned_date] = [];
      }
      sessionsByDate[session.planned_date].push(session);
    }
  }

  const sortedDates = Object.keys(sessionsByDate).sort();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Personalized Study Companion
            </span>
            <h2 className="text-2xl font-bold text-white mt-1">Daily Study Planner</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Deterministic schedule generation that strictly respects your available hours without past dates or overload.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Study Plan</span>
          </button>
        </div>
      </section>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Main Layout: Sidebar & Schedule Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Saved Plans */}
        <div className="w-full lg:w-72 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Your Plans</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{plans.length}</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="text-xs text-slate-500 py-4 text-center">Loading plans...</div>
            ) : plans.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">
                No study plans created yet. Click above to generate one.
              </div>
            ) : (
              plans.map((p) => {
                const isSelected = activePlan?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPlan(p.id)}
                    className={`group p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/30 text-white font-medium'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-semibold">{p.title}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        <span>Exam: {p.exam_date}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeletePlan(p.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition"
                      title="Delete plan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Plan View */}
        <div className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          {!activePlan ? (
            <div className="text-center py-16 space-y-3">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Study Plan Selected</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Create a study plan tailored to your exam date and daily available hours, or select an existing plan.
              </p>
            </div>
          ) : (
            <>
              {/* Plan Progress & Summary Card */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{activePlan.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Target Exam: <span className="font-mono text-indigo-400 font-semibold">{activePlan.exam_date}</span> &bull; Available Study Time: <span className="font-mono text-slate-200">{activePlan.daily_available_hours}h/day</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {Math.round((activePlan.completedSessions / (activePlan.totalSessions || 1)) * 100)}% Complete
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(activePlan.completedSessions / (activePlan.totalSessions || 1)) * 100}%`,
                    }}
                  />
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Sessions</span>
                    <span className="text-base font-bold text-white font-mono">
                      {activePlan.completedSessions} / {activePlan.totalSessions}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Study Minutes</span>
                    <span className="text-base font-bold text-indigo-400 font-mono">
                      {activePlan.completedMinutes} / {activePlan.totalStudyMinutes}m
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Days Covered</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      {sortedDates.length} days
                    </span>
                  </div>

                  <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
                    <span className="text-slate-400 block text-[11px]">Difficult Focus</span>
                    <span className="text-base font-bold text-rose-400 font-mono">
                      {activePlan.difficult_topics.length} topics
                    </span>
                  </div>
                </div>
              </div>

              {/* Sessions Timeline Grouped by Date */}
              <div className="space-y-6">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">
                  Daily Study Schedule
                </h4>

                {sortedDates.length === 0 ? (
                  <p className="text-xs text-slate-500">No sessions scheduled for this plan.</p>
                ) : (
                  sortedDates.map((dateStr) => {
                    const daySessions = sessionsByDate[dateStr] || [];
                    const dayTotalMinutes = daySessions.reduce((acc, s) => acc + s.duration_minutes, 0);
                    const isToday = dateStr === todayStr;

                    return (
                      <div key={dateStr} className="space-y-3">
                        <div className="flex items-center justify-between text-xs bg-slate-950/40 px-3.5 py-2 rounded-xl border border-slate-800/60">
                          <div className="flex items-center gap-2 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-white">{dateStr}</span>
                            {isToday && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                                Today
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400 font-mono">
                            {dayTotalMinutes} mins ({daySessions.length} sessions)
                          </span>
                        </div>

                        <div className="space-y-2">
                          {daySessions.map((session) => (
                            <div
                              key={session.id}
                              className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-4 ${
                                session.is_completed
                                  ? 'bg-emerald-950/15 border-emerald-500/30 text-slate-300'
                                  : 'bg-slate-950/60 border-slate-800 text-white hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleToggleSession(session)}
                                  className="text-slate-400 hover:text-indigo-400 transition"
                                  title={session.is_completed ? 'Mark incomplete' : 'Mark completed'}
                                >
                                  {session.is_completed ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                  ) : (
                                    <Circle className="w-5 h-5" />
                                  )}
                                </button>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5
                                      className={`text-sm font-semibold ${
                                        session.is_completed ? 'line-through text-slate-400' : 'text-white'
                                      }`}
                                    >
                                      {session.title}
                                    </h5>
                                    {session.priority === 'high' && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium flex items-center gap-0.5">
                                        <Flame className="w-2.5 h-2.5" /> High
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    Topic: <span className="text-slate-300 font-medium">{session.topic}</span> &bull; Suggested duration: <span className="font-mono text-indigo-300">{session.duration_minutes} min</span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEditSession(session)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                                  title="Edit session"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSession(session.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                  title="Delete session"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal: Create Plan */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Create Personalized Study Plan</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Plan Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Final Biology Exam Prep"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Exam Date <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Available Hours Per Day <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0.5"
                    max="16"
                    step="0.5"
                    value={dailyHours}
                    onChange={(e) => setDailyHours(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Preferred Session Duration
                </label>
                <select
                  value={preferredMinutes}
                  onChange={(e) => setPreferredMinutes(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes (Recommended)</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                </select>
              </div>

              {documents.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Study Notes / Course Documents
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-950 rounded-xl border border-slate-800">
                    {documents.map((d) => {
                      const isSelected = selectedDocIds.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedDocIds((prev) => prev.filter((id) => id !== d.id));
                            } else {
                              setSelectedDocIds((prev) => [...prev, d.id]);
                            }
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {d.filename}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Topics to Cover (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cellular Respiration, Photosynthesis, Genetics"
                  value={customTopics}
                  onChange={(e) => setCustomTopics(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Difficult Topics (prioritized with extra practice sessions)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Genetics, Electron Transport Chain"
                  value={difficultTopics}
                  onChange={(e) => setDifficultTopics(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !examDate}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition"
                >
                  {creating ? 'Generating Plan...' : 'Generate Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Session */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>Edit Study Session</span>
              </h3>
              <button onClick={() => setEditingSession(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditSession} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Session Title</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Planned Date</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Duration (mins)</label>
                  <input
                    type="number"
                    required
                    min={15}
                    max={240}
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs"
                >
                  <option value="high">High Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="low">Low Priority</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
