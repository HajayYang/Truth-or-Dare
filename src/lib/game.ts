import type { Gender, Question, QuestionType } from '../data/questions';

export type DrawMode = 'random' | QuestionType;

/** Only show universal prompts and prompts written for the selected player. */
export function eligibleQuestions(
  bank: readonly Question[],
  gender: Gender,
  mode: DrawMode,
): Question[] {
  return bank.filter(
    (question) =>
      (question.gender === 'all' || question.gender === gender) &&
      (mode === 'random' || question.type === mode),
  );
}

/** Draw without repeats; recycle the matching pool only after it is exhausted. */
export function drawQuestion(
  bank: readonly Question[],
  gender: Gender,
  mode: DrawMode,
  seenIds: readonly string[],
  random: () => number = Math.random,
): { question: Question; recycled: boolean } {
  const eligible = eligibleQuestions(bank, gender, mode);
  if (eligible.length === 0) {
    throw new Error('当前条件下没有可抽取的题目，请切换玩法后重试。');
  }

  const seen = new Set(seenIds);
  const unseen = eligible.filter((question) => !seen.has(question.id));
  const recycled = unseen.length === 0;
  const pool = recycled ? eligible : unseen;
  const sample = random();
  if (!Number.isFinite(sample)) {
    throw new RangeError('随机数必须为有限数值。');
  }

  // A custom random source may return either endpoint; keep its index in bounds.
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(sample * pool.length)));
  return { question: pool[index], recycled };
}
