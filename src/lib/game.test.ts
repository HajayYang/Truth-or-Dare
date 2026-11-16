import { describe, expect, it } from 'vitest';
import { questions, type Question } from '../data/questions';
import { drawQuestion, eligibleQuestions } from './game';

const bank: Question[] = [
  { id: 't-all', type: 'truth', text: '说说最近最开心的事。', gender: 'all', level: '轻松' },
  { id: 't-male', type: 'truth', text: '男生专属真心话。', gender: 'male', level: '走心' },
  { id: 't-female', type: 'truth', text: '女生专属真心话。', gender: 'female', level: '走心' },
  { id: 'd-all', type: 'dare', text: '模仿一个有趣的表情。', gender: 'all', level: '轻松' },
  { id: 'd-male', type: 'dare', text: '男生专属大冒险。', gender: 'male', level: '心跳' },
  { id: 'd-female', type: 'dare', text: '女生专属大冒险。', gender: 'female', level: '心跳' },
];

describe('the complete question database', () => {
  it('contains exactly 200 truths and 300 dares with unique ids and prompts', () => {
    expect(questions).toHaveLength(500);
    expect(questions.filter((question) => question.type === 'truth')).toHaveLength(200);
    expect(questions.filter((question) => question.type === 'dare')).toHaveLength(300);
    expect(new Set(questions.map((question) => question.id)).size).toBe(500);
    expect(new Set(questions.map((question) => question.text.trim())).size).toBe(500);
  });

  it('has complete numbered ids and valid, nonempty prompt records', () => {
    const ids = new Set(questions.map((question) => question.id));
    for (const [prefix, count] of [['T', 200], ['D', 300]] as const) {
      for (let index = 1; index <= count; index += 1) {
        expect(ids.has(`${prefix}${String(index).padStart(3, '0')}`)).toBe(true);
      }
    }
    for (const question of questions) {
      expect(question.text.trim().length).toBeGreaterThan(4);
      expect(['all', 'male', 'female']).toContain(question.gender);
      expect(['轻松', '走心', '心跳']).toContain(question.level);
      expect(question.id[0]).toBe(question.type === 'truth' ? 'T' : 'D');
    }
  });
});

describe('player and mode filtering', () => {
  it('combines universal prompts with only the selected gender', () => {
    expect(eligibleQuestions(bank, 'male', 'random').map((question) => question.id))
      .toEqual(['t-all', 't-male', 'd-all', 'd-male']);
    expect(eligibleQuestions(bank, 'female', 'random').map((question) => question.id))
      .toEqual(['t-all', 't-female', 'd-all', 'd-female']);
  });

  it('restricts truth and dare modes to their corresponding prompt type', () => {
    expect(eligibleQuestions(bank, 'female', 'truth').map((question) => question.id))
      .toEqual(['t-all', 't-female']);
    expect(eligibleQuestions(bank, 'male', 'dare').map((question) => question.id))
      .toEqual(['d-all', 'd-male']);
  });
});

describe('random drawing', () => {
  it('uses the random sample to select different questions', () => {
    expect(drawQuestion(bank, 'male', 'truth', [], () => 0).question.id).toBe('t-all');
    expect(drawQuestion(bank, 'male', 'truth', [], () => 0.75).question.id).toBe('t-male');
  });

  it('does not repeat a question until every eligible question has been drawn', () => {
    const seen: string[] = [];
    const size = eligibleQuestions(bank, 'female', 'random').length;
    for (let draw = 0; draw < size; draw += 1) {
      const result = drawQuestion(bank, 'female', 'random', seen, () => 0.5);
      expect(result.recycled).toBe(false);
      expect(seen).not.toContain(result.question.id);
      seen.push(result.question.id);
    }
    const next = drawQuestion(bank, 'female', 'random', seen, () => 0);
    expect(next.recycled).toBe(true);
    expect(seen).toContain(next.question.id);
  });

  it('ignores ids outside the current pool without prematurely recycling', () => {
    const result = drawQuestion(bank, 'male', 'truth', ['d-all', 't-female', 'missing'], () => 0);
    expect(result.recycled).toBe(false);
    expect(result.question.id).toBe('t-all');
  });

  it('keeps repeated draws within the real database gender and type filters', () => {
    const seen: string[] = [];
    const eligible = eligibleQuestions(questions, 'female', 'dare');
    for (let index = 0; index < eligible.length; index += 1) {
      const result = drawQuestion(questions, 'female', 'dare', seen, () => 0.37);
      expect(result.recycled).toBe(false);
      expect(result.question.type).toBe('dare');
      expect(['all', 'female']).toContain(result.question.gender);
      expect(seen).not.toContain(result.question.id);
      seen.push(result.question.id);
    }
    expect(drawQuestion(questions, 'female', 'dare', seen, () => 0.37).recycled).toBe(true);
  });

  it('throws a useful error when no eligible questions exist', () => {
    expect(() => drawQuestion([], 'male', 'random', [])).toThrow('没有可抽取的题目');
    expect(() => drawQuestion([bank[2]], 'male', 'truth', [])).toThrow('没有可抽取的题目');
  });

  it('clamps random-source endpoints to a valid question', () => {
    expect(drawQuestion(bank, 'male', 'truth', [], () => 1).question.id).toBe('t-male');
    expect(drawQuestion(bank, 'male', 'truth', [], () => -1).question.id).toBe('t-all');
    expect(drawQuestion(bank, 'male', 'truth', [], () => 2).question.id).toBe('t-male');
  });

  it('rejects invalid random-source values explicitly', () => {
    expect(() => drawQuestion(bank, 'male', 'truth', [], () => Number.NaN)).toThrow(RangeError);
    expect(() => drawQuestion(bank, 'male', 'truth', [], () => Infinity)).toThrow(RangeError);
  });

  it('does not mutate either the bank or the session history', () => {
    const snapshot = structuredClone(bank);
    const seen = ['t-all'];
    drawQuestion(bank, 'male', 'truth', seen, () => 0);
    expect(bank).toEqual(snapshot);
    expect(seen).toEqual(['t-all']);
  });
});
