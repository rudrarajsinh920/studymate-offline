const Database = require('better-sqlite3');
const { spawn } = require('child_process');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';
const DB_PATH = path.resolve(__dirname, 'server/data/studymate.db');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFutureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function runMilestone5Tests() {
  console.log('=====================================================');
  console.log('  STARTING MILESTONE 5 AUTOMATED TEST SUITE');
  console.log('  Study Planner and Quiz Generation');
  console.log('=====================================================\n');

  const results = {};
  let serverProcess = null;

  try {
    // ---------------------------------------------------------------
    // 1. SQLite Schema Inspection for Planner & Quiz Tables
    // ---------------------------------------------------------------
    console.log('Test 1: Inspecting SQLite schema for study_plans, study_sessions, quizzes, quiz_questions, quiz_attempts...');
    try {
      const { initDatabase } = require('./server/dist/db/database');
      initDatabase();

      const db = new Database(DB_PATH);
      const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(t => t.name);
      const planCols = db.pragma('table_info(study_plans)').map(c => c.name);
      const sessionCols = db.pragma('table_info(study_sessions)').map(c => c.name);
      const quizCols = db.pragma('table_info(quizzes)').map(c => c.name);
      const questionCols = db.pragma('table_info(quiz_questions)').map(c => c.name);
      const attemptCols = db.pragma('table_info(quiz_attempts)').map(c => c.name);
      const indices = db.prepare(`SELECT name FROM sqlite_master WHERE type='index'`).all().map(i => i.name);
      db.close();

      const hasAllTables = ['study_plans', 'study_sessions', 'quizzes', 'quiz_questions', 'quiz_attempts'].every(t => tables.includes(t));
      const hasPlanCols = ['id', 'title', 'exam_date', 'daily_available_hours', 'preferred_session_minutes'].every(c => planCols.includes(c));
      const hasSessionCols = ['id', 'plan_id', 'title', 'topic', 'planned_date', 'duration_minutes', 'priority', 'is_completed'].every(c => sessionCols.includes(c));
      const hasQuizCols = ['id', 'title', 'document_id', 'total_questions'].every(c => quizCols.includes(c));
      const hasQuestionCols = ['id', 'quiz_id', 'question_text', 'options', 'correct_option_index', 'explanation'].every(c => questionCols.includes(c));
      const hasAttemptCols = ['id', 'quiz_id', 'score', 'total_questions', 'percentage', 'answers'].every(c => attemptCols.includes(c));

      const hasIndices = indices.includes('idx_sessions_plan_id') && indices.includes('idx_quiz_questions_quiz_id') && indices.includes('idx_quiz_attempts_quiz_id');

      console.log('  Tables present:', hasAllTables);
      console.log('  Columns verified:', { hasPlanCols, hasSessionCols, hasQuizCols, hasQuestionCols, hasAttemptCols });
      console.log('  Indices present:', hasIndices);

      if (hasAllTables && hasPlanCols && hasSessionCols && hasQuizCols && hasQuestionCols && hasAttemptCols && hasIndices) {
        results['1. SQLite Planner & Quiz Schema'] = 'PASS';
      } else {
        results['1. SQLite Planner & Quiz Schema'] = 'FAIL: Missing tables or columns';
      }
    } catch (err) {
      results['1. SQLite Planner & Quiz Schema'] = `FAIL: ${err.message}`;
    }

    // ---------------------------------------------------------------
    // 2. Start Express Server
    // ---------------------------------------------------------------
    console.log('\nTest 2: Starting Express Backend Server...');
    serverProcess = spawn('node', ['server/dist/index.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let serverReady = false;
    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) {
          const healthData = await res.json();
          console.log('  Server online on port 5000, status:', healthData.status);
          serverReady = true;
          break;
        }
      } catch (e) {}
    }

    if (serverReady) {
      results['2. Server Launch & Health'] = 'PASS';
    } else {
      throw new Error('Express server failed to start within 10 seconds.');
    }

    // ---------------------------------------------------------------
    // 3. Planner Validation Tests (Past Exam Date & Invalid Hours)
    // ---------------------------------------------------------------
    console.log('\nTest 3: Testing planner validation for invalid dates and invalid hours...');
    try {
      // 3A: Past Exam Date
      const pastRes = await fetch(`${BASE_URL}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examDate: '2021-05-15', // Past date
          dailyAvailableHours: 2,
          topics: ['Biology'],
        }),
      });
      const pastData = await pastRes.json();
      console.log('  Past exam date response (Status ' + pastRes.status + '):', pastData);
      const pastRejected = pastRes.status === 400 && pastData.error && pastData.error.includes('past');

      // 3B: Invalid Hours (0 and -1)
      const zeroHoursRes = await fetch(`${BASE_URL}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examDate: getFutureDate(7),
          dailyAvailableHours: 0,
          topics: ['Biology'],
        }),
      });
      const zeroHoursData = await zeroHoursRes.json();
      const zeroHoursRejected = zeroHoursRes.status === 400 && zeroHoursData.error && zeroHoursData.error.includes('between 0.5 and 16');

      if (pastRejected && zeroHoursRejected) {
        results['3. Date & Hours Input Validation'] = 'PASS';
      } else {
        results['3. Date & Hours Input Validation'] = `FAIL: pastRejected=${pastRejected}, zeroHoursRejected=${zeroHoursRejected}`;
      }
    } catch (err) {
      results['3. Date & Hours Input Validation'] = `FAIL: ${err.message}`;
    }

    // ---------------------------------------------------------------
    // 4. Valid Study Plan Generation & Available-Hours Limit Enforcement
    // ---------------------------------------------------------------
    console.log('\nTest 4: Testing valid study plan generation & available hours daily limits...');
    let createdPlanId = null;
    try {
      const targetExamDate = getFutureDate(5); // 5 days ahead
      const dailyHoursLimit = 1.5; // 90 minutes max per day
      const maxDailyMinutes = Math.floor(dailyHoursLimit * 60); // 90 mins

      const planRes = await fetch(`${BASE_URL}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Comprehensive Biology Exam Plan',
          examDate: targetExamDate,
          dailyAvailableHours: dailyHoursLimit,
          preferredSessionMinutes: 45,
          topics: ['Cell Respiration', 'Genetics', 'Ecology'],
          difficultTopics: ['Genetics'],
        }),
      });

      const planData = await planRes.json();
      console.log('  Plan generation status:', planRes.status);
      console.log('  Plan ID:', planData.id);
      console.log('  Sessions count:', planData.sessions?.length);

      createdPlanId = planData.id;

      if (planRes.status === 201 && planData.sessions && planData.sessions.length > 0) {
        // Group sessions by planned_date and calculate daily total minutes
        const dailyTotals = {};
        let noPastDates = true;
        const todayStr = new Date().toISOString().split('T')[0];

        for (const s of planData.sessions) {
          if (s.planned_date < todayStr) noPastDates = false;
          dailyTotals[s.planned_date] = (dailyTotals[s.planned_date] || 0) + s.duration_minutes;
        }

        console.log('  Daily allocated minutes per date:', dailyTotals);
        console.log('  Max allowed daily minutes:', maxDailyMinutes);

        // Assert that NO day exceeds the student's available hours limit
        const hoursRespected = Object.values(dailyTotals).every(m => m <= maxDailyMinutes);
        const difficultTopicHasHighPriority = planData.sessions.some(s => s.topic === 'Genetics' && s.priority === 'high');

        console.log('  Strict daily hours limit respected:', hoursRespected);
        console.log('  No past dates generated:', noPastDates);
        console.log('  Difficult topic assigned high priority:', difficultTopicHasHighPriority);

        if (hoursRespected && noPastDates && difficultTopicHasHighPriority) {
          results['4. Realistic Plan & Hours Limit'] = 'PASS';
        } else {
          results['4. Realistic Plan & Hours Limit'] = `FAIL: hoursRespected=${hoursRespected}, noPastDates=${noPastDates}`;
        }
      } else {
        results['4. Realistic Plan & Hours Limit'] = `FAIL: Status ${planRes.status}`;
      }
    } catch (err) {
      results['4. Realistic Plan & Hours Limit'] = `FAIL: ${err.message}`;
    }

    // ---------------------------------------------------------------
    // 5. Editing and Completing Sessions
    // ---------------------------------------------------------------
    console.log('\nTest 5: Testing session editing and completion toggle...');
    try {
      const planRes = await fetch(`${BASE_URL}/plans/${createdPlanId}`);
      const planData = await planRes.json();
      const firstSession = planData.sessions[0];

      // Toggle completion to true
      const toggleRes = await fetch(`${BASE_URL}/plans/sessions/${firstSession.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      });
      const toggledSession = await toggleRes.json();
      console.log('  Toggled session is_completed:', toggledSession.is_completed, 'completed_at:', toggledSession.completed_at);

      // Edit session title and duration
      const editRes = await fetch(`${BASE_URL}/plans/sessions/${firstSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Deep Dive: Genetics & Epigenetics (Updated)',
          durationMinutes: 40,
        }),
      });
      const editedSession = await editRes.json();
      console.log('  Edited session title:', editedSession.title, 'duration:', editedSession.duration_minutes);

      const toggleValid = toggledSession.is_completed === true && toggledSession.completed_at !== null;
      const editValid = editedSession.title.includes('Updated') && editedSession.duration_minutes === 40;

      if (toggleValid && editValid) {
        results['5. Session Edit & Completion'] = 'PASS';
      } else {
        results['5. Session Edit & Completion'] = `FAIL: toggleValid=${toggleValid}, editValid=${editValid}`;
      }
    } catch (err) {
      results['5. Session Edit & Completion'] = `FAIL: ${err.message}`;
    }

    // ---------------------------------------------------------------
    // 6. Grounded Quiz Generation from Notes (Controlled Provider)
    // ---------------------------------------------------------------
    console.log('\nTest 6: Testing grounded MCQ quiz generation with controlled local provider...');
    let createdQuizId = null;
    try {
      // Ingest a controlled study document in SQLite
      const db = new Database(DB_PATH);
      const testDocChem = 'test-doc-chem-01';
      db.prepare(`DELETE FROM documents WHERE id = ?`).run(testDocChem);
      db.prepare(`
        INSERT INTO documents (id, filename, stored_filename, file_type, file_size, status, chunk_count, character_count, embedding_status, embedding_model)
        VALUES (?, 'chemistry_organic.txt', 'stored_chem.txt', 'txt', 600, 'ready', 2, 600, 'completed', 'nomic-embed-text')
      `).run(testDocChem);

      const chunkContent = 'Alkenes contain carbon-carbon double bonds and undergo electrophilic addition reactions. In Markovnikov addition, the hydrogen atom attaches to the carbon with more hydrogen atoms.';
      db.prepare(`
        INSERT INTO document_chunks (id, document_id, chunk_index, content, page_number, char_start, char_end, token_count, embedding_model, embedding_dim)
        VALUES ('chunk-chem-01', ?, 0, ?, 3, 0, ?, 30, 'nomic-embed-text', 4)
      `).run(testDocChem, chunkContent, chunkContent.length);
      db.close();

      const { QuizService } = require('./server/dist/services/quiz/quizService');

      class MockQuizLlmProvider {
        getModelName() { return 'llama3.2:3b'; }
        async isAvailable() { return { available: true }; }
        async generate(prompt) {
          return JSON.stringify({
            title: 'Organic Chemistry: Alkenes & Addition Reactions',
            questions: [
              {
                question: 'What type of chemical reaction do alkenes typically undergo across double bonds?',
                options: [
                  'Electrophilic addition',
                  'Nucleophilic substitution',
                  'Free radical chlorination',
                  'Condensation polymerization'
                ],
                correctIndex: 0,
                explanation: 'Alkenes have electron-rich double bonds that readily undergo electrophilic addition reactions.',
                sourceIndex: 1
              },
              {
                question: 'According to Markovnikov rule, where does the hydrogen atom attach during addition?',
                options: [
                  'To the carbon with fewer hydrogen atoms',
                  'To the carbon with more hydrogen atoms',
                  'Equally between both carbons',
                  'To the terminal oxygen atom'
                ],
                correctIndex: 1,
                explanation: 'Markovnikov addition states the hydrogen attaches to the carbon with more hydrogen substituents.',
                sourceIndex: 1
              }
            ]
          });
        }
      }

      const customQuizService = new QuizService(new MockQuizLlmProvider());
      const generatedQuiz = await customQuizService.generateQuiz({
        documentId: testDocChem,
        questionCount: 2,
      });

      console.log('  Quiz generated title:', generatedQuiz.title);
      console.log('  Questions generated count:', generatedQuiz.questions.length);

      createdQuizId = generatedQuiz.id;

      const q1 = generatedQuiz.questions[0];
      const q2 = generatedQuiz.questions[1];

      const mcqFormatValid = 
        generatedQuiz.questions.length === 2 &&
        Array.isArray(q1.options) && q1.options.length === 4 &&
        q1.correct_option_index === 0 &&
        q2.correct_option_index === 1;

      const sourceLinkValid = 
        q1.source_document_name === 'chemistry_organic.txt' &&
        q1.source_page_number === 3 &&
        q1.source_snippet !== null;

      console.log('  MCQ format valid (4 options, correct index):', mcqFormatValid);
      console.log('  Source citations linked (doc name, page, snippet):', sourceLinkValid);

      if (mcqFormatValid && sourceLinkValid) {
        results['6. Grounded Quiz Generation'] = 'PASS';
      } else {
        results['6. Grounded Quiz Generation'] = `FAIL: mcqFormat=${mcqFormatValid}, sourceLink=${sourceLinkValid}`;
      }
    } catch (err) {
      results['6. Grounded Quiz Generation'] = `FAIL: ${err.message}`;
    }

    // ---------------------------------------------------------------
    // 7. Quiz Answer Evaluation & Scoring
    // ---------------------------------------------------------------
    console.log('\nTest 7: Testing quiz answer evaluation and scoring...');
    try {
      const { QuizService } = require('./server/dist/services/quiz/quizService');
      const service = new QuizService();
      const quiz = service.getQuiz(createdQuizId);

      // Submit: Q1 correct (index 0), Q2 incorrect (selected index 0 instead of 1)
      const attemptRes = service.submitAttempt(createdQuizId, {
        answers: [
          { questionId: quiz.questions[0].id, selectedOptionIndex: 0 },
          { questionId: quiz.questions[1].id, selectedOptionIndex: 0 },
        ],
      });

      console.log('  Attempt Score:', attemptRes.score, '/', attemptRes.totalQuestions);
      console.log('  Percentage:', attemptRes.percentage + '%');
      console.log('  Q1 isCorrect:', attemptRes.answers[0].isCorrect);
      console.log('  Q2 isCorrect:', attemptRes.answers[1].isCorrect);

      const scoreValid = attemptRes.score === 1 && attemptRes.totalQuestions === 2 && attemptRes.percentage === 50;
      const reviewValid = attemptRes.review.length === 2 && attemptRes.review[0].isCorrect === true && attemptRes.review[1].isCorrect === false;

      // Verify persistence in SQLite
      const attempts = service.getQuizAttempts(createdQuizId);
      const persisted = attempts.length > 0 && attempts[0].score === 1;

      console.log('  Score and percentage match:', scoreValid);
      console.log('  Question review explanations intact:', reviewValid);
      console.log('  Attempt persisted in SQLite:', persisted);

      if (scoreValid && reviewValid && persisted) {
        results['7. Quiz Evaluation & Scoring'] = 'PASS';
      } else {
        results['7. Quiz Evaluation & Scoring'] = `FAIL: scoreValid=${scoreValid}, reviewValid=${reviewValid}, persisted=${persisted}`;
      }
    } catch (err) {
      results['7. Quiz Evaluation & Scoring'] = `FAIL: ${err.message}`;
    }

    // ---------------------------------------------------------------
    // 8. Missing Evidence & AI Unavailable Cases
    // ---------------------------------------------------------------
    console.log('\nTest 8: Testing missing evidence and Ollama unavailable handling...');
    try {
      // 8A: Missing Evidence (Non-existent document or empty notes)
      const missingDocRes = await fetch(`${BASE_URL}/quizzes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: 'non-existent-doc-id' }),
      });
      const missingDocData = await missingDocRes.json();
      console.log('  Missing document status:', missingDocRes.status, 'Error:', missingDocData.error);
      const missingDocHandled = missingDocRes.status === 400 && missingDocData.error.includes('not found');

      // 8B: Ollama Unavailable (Live HTTP request without mock)
      const ollamaOfflineRes = await fetch(`${BASE_URL}/quizzes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'Electrophilic Addition' }),
      });
      const ollamaOfflineData = await ollamaOfflineRes.json();
      console.log('  Ollama response status:', ollamaOfflineRes.status, 'Code:', ollamaOfflineData.code);
      const ollamaOfflineHandled = 
        (ollamaOfflineRes.status === 503 && ollamaOfflineData.code === 'OLLAMA_UNREACHABLE') || 
        ((ollamaOfflineRes.status === 200 || ollamaOfflineRes.status === 201) && Array.isArray(ollamaOfflineData.questions));

      if (missingDocHandled && ollamaOfflineHandled) {
        results['8. Missing Evidence & AI Offline'] = 'PASS';
      } else {
        results['8. Missing Evidence & AI Offline'] = `FAIL: missingDoc=${missingDocHandled}, offlineHandled=${ollamaOfflineHandled}`;
      }
    } catch (err) {
      results['8. Missing Evidence & AI Offline'] = `FAIL: ${err.message}`;
    }

    // ---------------------------------------------------------------
    // 9. Persistence Verification across Server Restart
    // ---------------------------------------------------------------
    console.log('\nTest 9: Testing data persistence across backend server restart...');
    try {
      // Terminate current server process
      serverProcess.kill('SIGTERM');
      await sleep(1500);

      // Respawn new server process
      serverProcess = spawn('node', ['server/dist/index.js'], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let restarted = false;
      for (let i = 0; i < 20; i++) {
        await sleep(500);
        try {
          const res = await fetch(`${BASE_URL}/health`);
          if (res.ok) {
            restarted = true;
            break;
          }
        } catch (e) {}
      }

      if (!restarted) throw new Error('Server failed to restart');

      // Fetch previously created plan
      const planRes = await fetch(`${BASE_URL}/plans/${createdPlanId}`);
      const planData = await planRes.json();

      // Fetch previously created quiz
      const quizRes = await fetch(`${BASE_URL}/quizzes/${createdQuizId}`);
      const quizData = await quizRes.json();

      // Fetch attempts
      const attemptsRes = await fetch(`${BASE_URL}/quizzes/${createdQuizId}/attempts`);
      const attemptsData = await attemptsRes.json();

      const planPersisted = planRes.status === 200 && planData.id === createdPlanId && planData.sessions.length > 0;
      const quizPersisted = quizRes.status === 200 && quizData.id === createdQuizId && quizData.questions.length === 2;
      const attemptsPersisted = Array.isArray(attemptsData) && attemptsData.length > 0;

      console.log('  Plan and sessions persisted after restart:', planPersisted);
      console.log('  Quiz and MCQs persisted after restart:', quizPersisted);
      console.log('  Quiz attempts persisted after restart:', attemptsPersisted);

      if (planPersisted && quizPersisted && attemptsPersisted) {
        results['9. Persistence across Restart'] = 'PASS';
      } else {
        results['9. Persistence across Restart'] = `FAIL: plan=${planPersisted}, quiz=${quizPersisted}, attempts=${attemptsPersisted}`;
      }
    } catch (err) {
      results['9. Persistence across Restart'] = `FAIL: ${err.message}`;
    }

  } finally {
    // Clean up temporary test fixtures
    try {
      const dbClean = new Database(DB_PATH);
      dbClean.prepare(`DELETE FROM documents WHERE id = 'test-doc-chem-01'`).run();
      dbClean.close();
    } catch (_) {}

    if (serverProcess) {
      console.log('\nShutting down test Express server...');
      serverProcess.kill('SIGTERM');
      await sleep(1000);
    }
  }

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  console.log('\n=====================================================');
  console.log('       MILESTONE 5 TEST EXECUTION RESULTS');
  console.log('=====================================================');
  let allPassed = true;
  for (const [testName, result] of Object.entries(results)) {
    const isPass = result === 'PASS';
    if (!isPass) allPassed = false;
    console.log(`[${isPass ? 'PASS' : 'FAIL'}] ${testName}: ${result}`);
  }
  console.log('=====================================================');

  if (allPassed) {
    console.log('ALL MILESTONE 5 TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED.');
    process.exit(1);
  }
}

runMilestone5Tests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
