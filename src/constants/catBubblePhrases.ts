export type CatBubblePhraseCategory = 'idleMorning' | 'idleAfternoon' | 'idleNight' | 'bored' | 'sleepy'

export const CAT_BUBBLE_PHRASES: Record<CatBubblePhraseCategory, string[]> = {
  idleMorning: [
    'pages.catBubble.idle.morning1',
    'pages.catBubble.idle.morning2',
    'pages.catBubble.idle.morning3',
  ],
  idleAfternoon: [
    'pages.catBubble.idle.afternoon1',
    'pages.catBubble.idle.afternoon2',
    'pages.catBubble.idle.afternoon3',
  ],
  idleNight: [
    'pages.catBubble.idle.night1',
    'pages.catBubble.idle.night2',
    'pages.catBubble.idle.night3',
  ],
  bored: [
    'pages.catBubble.proactive.bored1',
    'pages.catBubble.proactive.bored2',
    'pages.catBubble.proactive.bored3',
  ],
  sleepy: [
    'pages.catBubble.proactive.sleepy1',
    'pages.catBubble.proactive.sleepy2',
    'pages.catBubble.proactive.sleepy3',
  ],
}

export const CAT_BUBBLE_HINTS = [
  'pages.catBubble.hints.chat',
  'pages.catBubble.hints.touch',
  'pages.catBubble.hints.stay',
]

export function getCatBubbleIdleCategory(hour: number): 'idleMorning' | 'idleAfternoon' | 'idleNight' {
  if (hour >= 5 && hour < 12) return 'idleMorning'

  if (hour >= 12 && hour < 18) return 'idleAfternoon'

  return 'idleNight'
}
