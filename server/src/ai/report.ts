export const ROYAL_BRICK_CRITERIA = [
  { id: 'greeting', title: 'Приветствие и установление контакта', maxScore: 8 },
  { id: 'needs', title: 'Выявление потребностей', maxScore: 20 },
  { id: 'comparison', title: 'Сравнение облицовочных материалов', maxScore: 5 },
  { id: 'productPresentation', title: 'Презентация продукции Royal Brick', maxScore: 15 },
  { id: 'emotionalPresentation', title: 'Эмоциональная презентация', maxScore: 10 },
  { id: 'pricing', title: 'Расчёт и презентация стоимости', maxScore: 10 },
  { id: 'prepayment', title: 'Закрытие на предоплату', maxScore: 15 },
  { id: 'objections', title: 'Работа с возражениями', maxScore: 10 },
  { id: 'closing', title: 'Завершение встречи и следующий шаг', maxScore: 7 },
] as const;

export type RoyalBrickCriterionId = typeof ROYAL_BRICK_CRITERIA[number]['id'];
export type EvaluationState = 'scored' | 'no_data' | 'not_applicable';
export type EvidenceKind = 'fact' | 'hypothesis' | 'limitation';

export interface EvidenceItem {
  text: string;
  quote?: string;
  timestamp?: string;
  kind: EvidenceKind;
}

export interface CriterionEvaluation {
  id: RoyalBrickCriterionId;
  title: string;
  maxScore: number;
  state: EvaluationState;
  score: number | null;
  comment: string;
  mainGap?: string;
  evidence: EvidenceItem[];
}

export interface MeetingCard {
  meetingDate: string | null;
  manager: string | null;
  meetingId: string;
  format: 'initial' | 'repeat' | 'undetermined';
  durationSeconds: number | null;
  client: string | null;
  objectDescription: string | null;
  selectedProduct: string | null;
  panelCount: number | null;
  listPrice: number | null;
  installment: string | null;
  monthlyPayment: number | null;
  saleDiscount: string | null;
  salePrice: number | null;
  prepayment: number | null;
  meetingResult: string | null;
  nextContact: string | null;
}

export interface PriceSequenceCheck {
  panelCount: 'done' | 'not_done' | 'no_data';
  listPrice: 'done' | 'not_done' | 'no_data';
  installment: 'done' | 'not_done' | 'not_applicable' | 'no_data';
  salePrice: 'done' | 'not_done' | 'not_applicable' | 'no_data';
  immediateClosing: 'done' | 'not_done' | 'not_applicable' | 'no_data';
  sequence: 'followed' | 'partially_followed' | 'broken' | 'no_data';
  mainIssue: string | null;
}

export interface OverallAssessment {
  score: number | null;
  coverage: number;
  evaluatedMaxScore: number;
  level: 'excellent' | 'good' | 'satisfactory' | 'weak' | 'unsatisfactory' | 'not_available';
  summary: string;
  criteria: CriterionEvaluation[];
  priceSequence: PriceSequenceCheck;
}

export interface ManagerError {
  error: string;
  whyItMatters: string;
  correction: string;
  examplePhrase: string;
  priority: 'high' | 'medium' | 'low';
  evidence: EvidenceItem[];
}

export interface ObjectionAnalysis {
  clientQuote: string;
  probableReason: string;
  managerResponse: string;
  responseAssessment: string;
  remainsOpen: boolean | null;
  betterFormulation: string;
}

export interface ClientAnalysis {
  primaryType: 'rational' | 'emotional' | 'mixed' | 'undetermined';
  additionalFeatures: Array<{ feature: string; basis: string; confidence: 'high' | 'medium' | 'low'; guidance: string }>;
  keyCriteria: Array<{ criterion: string; priority: 'high' | 'medium' | 'low' | 'undetermined'; evidence: EvidenceItem[]; salesUse: string }>;
  desiredOutcome: string;
  explicitConcerns: string[];
  probableConcerns: string[];
  positiveReactions: string[];
  negativeReactions: string[];
  decisionStage: 'research' | 'comparison' | 'selection' | 'near_purchase' | 'ready_to_order' | 'undetermined';
  purchaseLikelihood: 'high' | 'medium' | 'low' | 'insufficient_data';
  rationale: string;
}

export interface MissedSalesOpportunity {
  clientQuote: string | null;
  managerReaction: string | null;
  whyImportant: string;
  betterResponse: string;
  expectedInfluence: string;
}

export interface ClientRecommendation {
  nextAction: string;
  timing: string;
  openingQuestion: string;
  arguments: string[];
  materials: string[];
  avoidSaying: string[];
  proposedStep: string;
  rationale: string;
}

export interface ManagerRecommendation {
  skill: string;
  observedError: string;
  correctAction: string;
  examplePhrase: string;
  practiceExercise: string;
}

export interface RoyalBrickReport {
  reportVersion: '1.0';
  meetingCard: MeetingCard;
  overallAssessment: OverallAssessment;
  managerStrengths: EvidenceItem[];
  managerErrors: ManagerError[];
  clientAnalysis: ClientAnalysis;
  objections: ObjectionAnalysis[];
  missedSalesOpportunity: MissedSalesOpportunity;
  clientRecommendations: ClientRecommendation;
  nextCallScript: string;
  clientMessage: string;
  managerRecommendations: ManagerRecommendation[];
  crmSummary: string;
  managerConclusion: string;
  criticalViolations: string[];
}
