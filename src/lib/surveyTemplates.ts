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

// Curated starter surveys. "Load template" adds these to the survey being edited (saved with it); everything stays
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

// Starter forms for a clan event's sign-ups (stage 'signup'): what a host usually needs to know before
// the day. Same shape and the same loader as the surveys, and just as editable once loaded.
export const SIGNUP_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'signup-pvm-mass',
    name: 'PvM mass',
    description: 'Role, experience and what they’re bringing — for boss masses and learner runs.',
    questions: [
      { type: 'single', prompt: 'What role do you want?', options: ['DPS', 'Tank', 'Support', 'Whatever’s needed'], required: true },
      { type: 'single', prompt: 'How experienced are you at this boss?', options: ['First time', 'A few kills', 'Comfortable', 'Can teach'], required: true },
      { type: 'text', prompt: 'Your gear / setup (optional)' },
    ],
  },
  {
    id: 'signup-raid-team',
    name: 'Raid team',
    description: 'KC, preferred role and when they can play — for building raid teams.',
    questions: [
      { type: 'single', prompt: 'Your KC at this raid', options: ['0', '1–25', '26–100', '100+'], required: true },
      { type: 'single', prompt: 'Preferred role', options: ['Mage', 'Range', 'Melee', 'Any'] },
      { type: 'multi', prompt: 'When can you play?', options: ['Weekday evenings', 'Weekday late', 'Weekend days', 'Weekend evenings'] },
    ],
  },
  {
    id: 'signup-skilling',
    name: 'Skilling / social',
    description: 'Just their timezone and anything to add — light enough for a skilling or social night.',
    questions: [
      { type: 'single', prompt: 'Your timezone', options: ['Americas', 'Europe / Africa', 'Asia / Oceania'] },
      { type: 'text', prompt: 'Anything we should know?' },
    ],
  },
  {
    id: 'signup-competition',
    name: 'Competition / bingo',
    description: 'Hours they can give, experience and team preferences — for team competitions.',
    questions: [
      { type: 'single', prompt: 'How many hours a day can you play during it?', options: ['Under 2', '2–4', '4–8', '8+'], required: true },
      { type: 'single', prompt: 'Have you played one of these before?', options: ['Yes', 'No'] },
      { type: 'text', prompt: 'Anyone you’d like to be teamed with?' },
    ],
  },
];

export function surveyTemplateById(id: string): SurveyTemplate | undefined {
  return SURVEY_TEMPLATES.find((t) => t.id === id) ?? SIGNUP_TEMPLATES.find((t) => t.id === id);
}
