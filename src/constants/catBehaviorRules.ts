export const GREETING_KEYWORDS = [
  '你好',
  '您好',
  '嗨',
  '哈喽',
  'hello',
  'hi',
  '在吗',
  '早安',
  '午安',
  '晚安',
]

export const NEGATIVE_KEYWORDS = [
  '生气',
  '气死',
  '好气',
  '哼',
  '烦',
  '不开心',
  '讨厌',
  '不理你',
]

export const PRAISE_KEYWORDS = [
  '厉害',
  '好棒',
  '真棒',
  '太强',
  '牛逼',
  '帅',
  '聪明',
  'cool',
  'amazing',
  'great',
]

export const COMFORT_KEYWORDS = [
  '晚安',
  '抱抱',
  '摸摸',
  '安慰',
  '辛苦了',
  '累了',
  '别难过',
  '心疼',
  '乖',
]

export function containsAnyKeyword(text: string, keywords: string[]) {
  const normalized = text.toLowerCase()

  return keywords.some(keyword => normalized.includes(keyword.toLowerCase()))
}
