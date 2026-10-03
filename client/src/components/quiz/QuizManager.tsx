import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  Award, 
  RefreshCw, 
  BookOpen, 
  FileText, 
  Trash2, 
  AlertCircle
} from 'lucide-react';
import { 
  QuizRecord, 
  QuizWithQuestions, 
  SubmitQuizAttemptResponse 
} from 'studymate-shared';
import { 
  generateQuiz, 
  getQuizzes, 
  getQuiz, 
  deleteQuiz, 
  submitQuizAttempt, 
  QuizApiError 
} from '../../api/quiz';
import { DocumentSummary } from '../../api/documents';

interface QuizManagerProps {
  documents: DocumentSummary[];
}

export const QuizManager: React.FC<QuizManagerProps> = ({ documents }) => {
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<QuizWithQuestions | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ message: string; instructions?: string } | null>(null);

  // Generator Form State
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [selectedDocId, setSelectedDocId] = useState<string>('all');
  const [quizTopic, setQuizTopic] = useState<string>('');
  const [questionCount, setQuestionCount] = useState<number>(5);

  // Quiz Taking & Submission State
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<SubmitQuizAttemptResponse | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const list = await getQuizzes();
      setQuizzes(list);
    } catch (err) {
      console.error('Failed to load quizzes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuiz = async (quizId: string) => {
    setLoading(true);
    setErrorBanner(null);
    setQuizResult(null);
    setSelectedAnswers({});
    try {
      const fullQuiz = await getQuiz(quizId);
      setActiveQuiz(fullQuiz);
    } catch (err) {
      console.error('Failed to load quiz details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setErrorBanner(null);

    try {
      const newQuiz = await generateQuiz({
        documentId: selectedDocId !== 'all' ? selectedDocId : undefined,
        topic: quizTopic.trim() || undefined,
        questionCount: Number(questionCount),
      });

      setQuizzes((prev) => [newQuiz, ...prev]);
      setActiveQuiz(newQuiz);
      setSelectedAnswers({});
      setQuizResult(null);
      setShowGenerateModal(false);
      setQuizTopic('');
    } catch (err: unknown) {
      if (err instanceof QuizApiError) {
        setErrorBanner({
          message: err.message,
          instructions: err.instructions,
        });
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to generate quiz';
        setErrorBanner({ message: msg });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteQuiz = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this practice quiz?')) return;

    try {
      await deleteQuiz(id);
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
      if (activeQuiz?.id === id) {
        setActiveQuiz(null);
        setQuizResult(null);
      }
    } catch (err) {
      alert('Failed to delete quiz');
    }
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (quizResult) return; // Prevent changing after submission
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;

    const answersPayload = activeQuiz.questions.map((q) => ({
      questionId: q.id,
      selectedOptionIndex: selectedAnswers[q.id] !== undefined ? selectedAnswers[q.id] : -1,
    }));

    setSubmitting(true);
    try {
      const result = await submitQuizAttempt(activeQuiz.id, {
        answers: answersPayload,
      });
      setQuizResult(result);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit quiz attempt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetakeQuiz = () => {
    setSelectedAnswers({});
    setQuizResult(null);
  };

  const answeredCount = activeQuiz ? Object.keys(selectedAnswers).length : 0;
  const totalQuestionsCount = activeQuiz ? activeQuiz.questions.length : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Active Recall &amp; Self-Testing
            </span>
            <h2 className="text-2xl font-bold text-white mt-1">Course Quizzes &amp; Practice</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Generate grounded multiple-choice questions directly from your uploaded notes passages with instant scoring and verified citations.
            </p>
          </div>

          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition shadow-lg shadow-indigo-600/20 flex-shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate New Quiz</span>
          </button>
        </div>
      </section>

      {/* Error Banner */}
      {errorBanner && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorBanner.message}</p>
              {errorBanner.instructions && (
                <pre className="mt-1.5 p-2 bg-slate-950 rounded border border-rose-500/20 text-rose-200 font-mono text-[11px] whitespace-pre-wrap">
                  {errorBanner.instructions}
                </pre>
              )}
            </div>
          </div>
          <button onClick={() => setErrorBanner(null)} className="text-rose-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Quiz Library */}
        <div className="w-full lg:w-72 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <span>Practice Quizzes</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">{quizzes.length}</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="text-xs text-slate-500 py-4 text-center">Loading quizzes...</div>
            ) : quizzes.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">
                No practice quizzes generated yet. Click &ldquo;Generate New Quiz&rdquo; above.
              </div>
            ) : (
              quizzes.map((q) => {
                const isSelected = activeQuiz?.id === q.id;
                return (
                  <div
                    key={q.id}
                    onClick={() => handleSelectQuiz(q.id)}
                    className={`group p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500/30 text-white font-medium'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-semibold">{q.title}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 font-mono">
                        <span>{q.total_questions} questions</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteQuiz(q.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition"
                      title="Delete quiz"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Quiz Arena */}
        <div className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          {!activeQuiz ? (
            <div className="text-center py-16 space-y-3">
              <HelpCircle className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Quiz Selected</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Generate a practice quiz from your uploaded study materials or select an existing quiz to test your active recall.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Quiz Header Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">{activeQuiz.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeQuiz.total_questions} Multiple-Choice Questions &bull; Grounded in course notes
                  </p>
                </div>

                {quizResult ? (
                  <button
                    onClick={handleRetakeQuiz}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retake Quiz</span>
                  </button>
                ) : (
                  <div className="text-xs text-slate-400 font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    Answered: <span className="text-indigo-400 font-bold">{answeredCount}</span> / {totalQuestionsCount}
                  </div>
                )}
              </div>

              {/* Quiz Results Summary Card */}
              {quizResult && (
                <div className={`p-5 rounded-2xl border ${
                  quizResult.percentage >= 70
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-amber-950/20 border-amber-500/40'
                } space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${
                        quizResult.percentage >= 70 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        <Award className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">Quiz Attempt Results</h4>
                        <p className="text-xs text-slate-400">
                          {quizResult.percentage >= 70
                            ? 'Excellent performance! High retention of course concepts.'
                            : 'Good effort! Review the verified explanations below to reinforce weak areas.'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold font-mono text-white">
                        {quizResult.percentage}%
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {quizResult.score} / {quizResult.totalQuestions} Correct
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Questions List */}
              <div className="space-y-6">
                {activeQuiz.questions.map((q, qIndex) => {
                  const userChoice = selectedAnswers[q.id];
                  const reviewItem = quizResult?.review.find((r) => r.questionId === q.id);

                  return (
                    <div
                      key={q.id}
                      className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 mt-0.5">
                            {qIndex + 1}
                          </span>
                          <h4 className="text-sm font-semibold text-white leading-relaxed">
                            {q.question_text}
                          </h4>
                        </div>

                        {reviewItem && (
                          <div className="flex-shrink-0">
                            {reviewItem.isCorrect ? (
                              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <XCircle className="w-3.5 h-3.5" /> Incorrect
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.options.map((option, optIdx) => {
                          const isSelected = userChoice === optIdx;
                          const isCorrect = q.correct_option_index === optIdx;

                          let optionStyles = 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700';

                          if (quizResult) {
                            if (isCorrect) {
                              optionStyles = 'bg-emerald-950/30 border-emerald-500/60 text-emerald-200 font-semibold';
                            } else if (isSelected && !isCorrect) {
                              optionStyles = 'bg-rose-950/30 border-rose-500/60 text-rose-200 line-through';
                            }
                          } else if (isSelected) {
                            optionStyles = 'bg-indigo-600/20 border-indigo-500/60 text-white font-medium';
                          }

                          const optionLetter = String.fromCharCode(65 + optIdx);

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSelectOption(q.id, optIdx)}
                              disabled={!!quizResult}
                              className={`p-3 rounded-xl border text-left text-xs transition flex items-center gap-2.5 ${optionStyles}`}
                            >
                              <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[10px] font-bold flex-shrink-0">
                                {optionLetter}
                              </span>
                              <span className="flex-1 leading-snug">{option}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Review Section (Explanation & Source Citation) */}
                      {quizResult && reviewItem && (
                        <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-slate-300">
                            <span className="font-semibold text-indigo-400 block mb-1">
                              Explanation:
                            </span>
                            <p className="leading-relaxed">{reviewItem.explanation}</p>
                          </div>

                          {reviewItem.sourceDocumentName && (
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
                              <FileText className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Source: <strong>{reviewItem.sourceDocumentName}</strong></span>
                              {reviewItem.sourcePageNumber && (
                                <span className="font-mono text-slate-500">p.{reviewItem.sourcePageNumber}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Action Bar */}
              {!quizResult && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <span className="text-xs text-slate-500">
                    {answeredCount < totalQuestionsCount
                      ? `${totalQuestionsCount - answeredCount} unanswered questions remaining`
                      : 'All questions answered!'}
                  </span>

                  <button
                    onClick={handleSubmitQuiz}
                    disabled={submitting || answeredCount === 0}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs transition shadow-lg shadow-indigo-600/20"
                  >
                    {submitting ? 'Submitting...' : 'Submit Answers'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generator Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Generate Grounded Practice Quiz</span>
              </h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleGenerateQuiz} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Source Study Document
                </label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs"
                >
                  <option value="all">All Uploaded Notes</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Specific Topic Focus (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Krebs cycle, Mendelian genetics, Thermodynamics"
                  value={quizTopic}
                  onChange={(e) => setQuizTopic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-semibold">
                  Number of Multiple-Choice Questions: {questionCount}
                </label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>3 Questions</span>
                  <span>5 Questions</span>
                  <span>10 Questions</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition"
                >
                  {generating ? 'Generating MCQs...' : 'Generate Quiz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
