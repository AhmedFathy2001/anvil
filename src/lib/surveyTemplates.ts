import type { SurveyQuestionType } from '@/lib/survey';

// A ready-made question an admin can load into an event's survey and then edit. Mirrors the shape of a
// survey_questions row minus the persisted columns (id/eventId/position/createdAt).
export interface SurveyTemplateQuestion {
  type: SurveyQuestionType;
  prompt: string;
  options?: string[];
  required?: boolean;
}

export interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  questions: SurveyTemplateQuestion[];
}

// Curated starter surveys. "Load template" appends these to the event's survey; everything stays
// editable afterwards, so admins can start here and tweak or build entirely from scratch.
export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'bingo-wrap-up',
    name: 'Bingo wrap-up',
    description: 'A rounded post-event check-in — enjoyment, balance, pace, and open feedback.',
    questions: [
      { type: 'rating', prompt: 'Overall, how much did you enjoy this event?', required: true },
      { type: 'single', prompt: 'How was the difficulty / tile balance?', options: ['Too easy', 'About right', 'Too hard'], required: true },
      { type: 'single', prompt: 'How was the event length?', options: ['Too short', 'Just right', 'Too long'] },
      { type: 'rating', prompt: 'How clear were the rules and tile requirements?' },
      { type: 'single', prompt: 'Would you join another event like this?', options: ['Definitely', 'Probably', 'Maybe', 'No'], required: true },
      { type: 'multi', prompt: 'Which parts worked well for you?', options: ['Tile variety', 'Team / draft', 'Pace', 'Communication', 'Prizes', 'The RuneLite plugin'] },
      { type: 'text', prompt: 'What did you enjoy most?' },
      { type: 'text', prompt: 'What should we improve next time?' },
    ],
  },
  {
    id: 'quick-pulse',
    name: 'Quick pulse',
    description: 'Three questions — a fast read when you just want a temperature check.',
    questions: [
      { type: 'rating', prompt: 'How would you rate this event overall?', required: true },
      { type: 'single', prompt: 'Would you play again?', options: ['Yes', 'Maybe', 'No'], required: true },
      { type: 'text', prompt: 'Any comments?' },
    ],
  },
];

export function surveyTemplateById(id: string): SurveyTemplate | undefined {
  return SURVEY_TEMPLATES.find((t) => t.id === id);
}
