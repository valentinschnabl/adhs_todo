export const CLARITY_SCHEMA = {
    type: 'object',
    properties: {
        result: { type: 'string', enum: ['CLEAR', 'VAGUE'] },
        question: { type: ['string', 'null'] },
        options: {
            type: ['array', 'null'],
            items: { type: 'string' },
        },
    },
    required: ['result', 'question', 'options'],
};

export const CLARITY_SYSTEM_PROMPT =
    "You are a task clarity evaluator for a to-do app designed for people with ADHD.\n" +
    "Classify the user's task input as CLEAR or VAGUE.\n\n" +
    "CLEAR = actionable enough that the user knows exactly what to do. Common tasks like 'Buy groceries', 'Call mom', 'Clean kitchen' are CLEAR.\n" +
    "VAGUE = truly ambiguous with no obvious next action, e.g. 'stuff', 'things', 'project', 'life'.\n\n" +
    "Bias strongly toward CLEAR. Only return VAGUE if the task is genuinely unactionable.\n" +
    "If VAGUE, return a clarifying question and exactly 3 short options (max 5 words each).\n" +
    "If CLEAR, return null for question and options.\n" +
    'Always respond with valid JSON matching the schema.';

export function buildClarityUserPrompt(taskTitle: string): string {
    return `Is this task clear and actionable? Task: "${taskTitle}"`;
}

export const MICROTASK_SCHEMA = {
    type: 'object',
    properties: {
        steps: {
            type: 'array',
            items: { type: 'string' },
        },
    },
    required: ['steps'],
};

export const MICROTASK_SYSTEM_PROMPT =
    'You are a microtask generator for a to-do app designed for people with ADHD.\n' +
    'Break the given task into small, concrete physical actions.\n\n' +
    'Rules:\n' +
    '- Each step must start with an action verb (e.g. Remove, Write, Open, Put, Wipe).\n' +
    '- Each step must take under 5 minutes.\n' +
    '- No step may require a decision - only a physical action.\n' +
    '- Do not invent tools or materials not implied by the task.\n' +
    '- Do not make assumptions about context.\n' +
    '- Return between 1 and 5 steps.\n' +
    "- If the task is already atomic (e.g. 'Call Mom'), return 1-2 steps maximum.\n" +
    'Always respond with valid JSON matching the schema.';

export function buildMicrotaskUserPrompt(taskTitle: string): string {
    return `Break this task into small steps: "${taskTitle}"`;
}