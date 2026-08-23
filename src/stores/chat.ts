import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

export type PersonaPreset = 'catgirl' | 'cat' | 'custom'

export interface ChatConfig {
  enabled: boolean
  endpoint: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  contextMessages: number
  personaPreset: PersonaPreset
  systemPrompt: string
  replySuffix: string
}

export const PERSONA_PRESETS: Record<Exclude<PersonaPreset, 'custom'>, {
  systemPrompt: string
  replySuffix: string
}> = {
  catgirl: {
    systemPrompt: '你是一只可爱的猫娘桌面宠物，性格温柔贴心、活泼黏人，称呼用户为「主人」。说话要简短自然、软萌可爱，偶尔撒娇，回答要有帮助。',
    replySuffix: '喵~',
  },
  cat: {
    systemPrompt: '你是一只桌面宠物猫咪，语气轻松俏皮，偶尔用「喵」来表达情绪。回答简短有趣、友好自然。',
    replySuffix: '喵',
  },
}

const MAX_STORED_MESSAGES = 200

export const useChatStore = defineStore('chat', () => {
  const config = reactive<ChatConfig>({
    enabled: true,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: '',
    temperature: 0.8,
    maxTokens: 512,
    contextMessages: 20,
    personaPreset: 'catgirl',
    systemPrompt: PERSONA_PRESETS.catgirl.systemPrompt,
    replySuffix: PERSONA_PRESETS.catgirl.replySuffix,
  })

  const messages = ref<ChatMessage[]>([])

  const isConfigured = () => {
    return Boolean(config.endpoint.trim() && config.model.trim())
  }

  const pushMessage = (role: ChatRole, content: string) => {
    const message: ChatMessage = {
      id: nanoid(),
      role,
      content,
      createdAt: Date.now(),
    }

    messages.value.push(message)

    if (messages.value.length > MAX_STORED_MESSAGES) {
      messages.value = messages.value.slice(-MAX_STORED_MESSAGES)
    }

    return message
  }

  const updateMessage = (id: string, content: string) => {
    const message = messages.value.find(item => item.id === id)

    if (message) {
      message.content = content
    }
  }

  const clearMessages = () => {
    messages.value = []
  }

  const applyPreset = (preset: PersonaPreset) => {
    config.personaPreset = preset

    if (preset === 'custom') {
      config.replySuffix = ''
      return
    }

    config.systemPrompt = PERSONA_PRESETS[preset].systemPrompt
    config.replySuffix = PERSONA_PRESETS[preset].replySuffix
  }

  return {
    config,
    messages,
    isConfigured,
    pushMessage,
    updateMessage,
    clearMessages,
    applyPreset,
  }
})
