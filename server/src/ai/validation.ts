import { ROYAL_BRICK_CRITERIA, type CriterionEvaluation, type RoyalBrickReport } from './report.js';

export interface ScoreSummary {
  totalScore: number;
  evaluatedMaxScore: number;
  normalizedScore: number | null;
  coverage: number;
}

export class AnalysisValidationError extends Error {
  readonly code = 'ANALYSIS_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisValidationError';
  }
}

const round = (value: number): number => Math.round(value * 100) / 100;

export const calculateScoreSummary = (criteria: CriterionEvaluation[]): ScoreSummary => {
  let totalScore = 0;
  let evaluatedMaxScore = 0;
  for (const criterion of criteria) {
    if (criterion.state !== 'scored') continue;
    if (criterion.score === null || !Number.isFinite(criterion.score)) throw new AnalysisValidationError(`Для критерия «${criterion.title}» не указан балл`);
    if (criterion.score < 0 || criterion.score > criterion.maxScore) throw new AnalysisValidationError(`Баллы критерия «${criterion.title}» выходят за допустимый диапазон`);
    totalScore += criterion.score;
    evaluatedMaxScore += criterion.maxScore;
  }
  return {
    totalScore: round(totalScore),
    evaluatedMaxScore,
    normalizedScore: evaluatedMaxScore === 0 ? null : round((totalScore / evaluatedMaxScore) * 100),
    coverage: round((evaluatedMaxScore / 100) * 100),
  };
};

export const validateCriteria = (criteria: CriterionEvaluation[]): ScoreSummary => {
  if (criteria.length !== ROYAL_BRICK_CRITERIA.length) throw new AnalysisValidationError('Отчёт должен содержать ровно девять критериев Royal Brick');
  for (const expected of ROYAL_BRICK_CRITERIA) {
    const criterion = criteria.find((item) => item.id === expected.id);
    if (!criterion) throw new AnalysisValidationError(`В отчёте отсутствует критерий «${expected.title}»`);
    if (criterion.title !== expected.title || criterion.maxScore !== expected.maxScore) throw new AnalysisValidationError(`Изменены название или вес критерия «${expected.title}»`);
    if (criterion.state !== 'scored' && criterion.score !== null) throw new AnalysisValidationError(`Для «${expected.title}» с состоянием без оценки балл должен быть null`);
  }
  return calculateScoreSummary(criteria);
};

export const validateRoyalBrickReport = (report: RoyalBrickReport): ScoreSummary => {
  const summary = validateCriteria(report.overallAssessment.criteria);
  const reportedScore = report.overallAssessment.score;
  const reportedCoverage = report.overallAssessment.coverage;
  if (reportedScore !== summary.normalizedScore) throw new AnalysisValidationError('Итоговый балл не совпадает с нормализованной суммой критериев');
  if (reportedCoverage !== summary.coverage) throw new AnalysisValidationError('Охват оценки не совпадает с суммой оцениваемых весов');
  if (report.crmSummary.length > 1000) throw new AnalysisValidationError('CRM-резюме не должно превышать 1000 символов');
  return summary;
};
