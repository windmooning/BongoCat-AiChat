import { isTauri } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import type { ChatConfig, ChatMessage } from '@/stores/chat'

export type ChatApiErrorKind = 'aborted' | 'http' | 'network' | 'stream'

export class ChatApiError extends Error {
  readonly kind: ChatApiErrorKind
  readonly status?: number

  constructor(kind: ChatApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ChatApiError'
    this.kind = kind
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getPayloadContent(payload: unknown) {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return

  const firstChoice = payload.choices[0]

  if (!isRecord(firstChoice)) return

  const delta = isRecord(firstChoice.delta) ? firstChoice.delta : undefined
  const message = isRecord(firstChoice.message) ? firstChoice.message : undefined

  if (typeof delta?.content === 'string' && delta.content) return delta.content

  if (typeof message?.content === 'string' && message.content) return message.content
}

function getPayloadError(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.error)) return

  if (typeof payload.error.message === 'string' && payload.error.message) {
    return payload.error.message
  }
}

function doFetch(input: string, init: RequestInit & { connectTimeout?: number }) {
  if (isTauri()) {
    return tauriFetch(input, init)
  }

  return globalThis.fetch(input, init)
}

function getHttpErrorMessage(status: number, payload: string) {
  const parsed = (() => {
    try {
      return JSON.parse(payload) as unknown
    } catch {
      return undefined
    }
  })()

  const apiMessage = parsed ? getPayloadError(parsed) : undefined

  if (apiMessage) return apiMessage

  const messages: Record<number, string> = {
    400: '请求参数有误，请检查接口地址和模型名',
    401: 'API Key 无效或没有访问权限',
    403: '当前 API Key 没有访问该模型的权限',
    404: '接口地址不存在，请检查 Endpoint',
    429: '请求过于频繁，请稍后再试',
    500: '模型服务暂时不可用，请稍后再试',
  }

  return messages[status] ?? `模型服务返回错误（HTTP ${status}）`
}

export function buildChatMessages(config: ChatConfig, history: ChatMessage[]) {
  const messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = []

  if (config.systemPrompt.trim()) {
    messages.push({
      role: 'system',
      content: config.systemPrompt.trim(),
    })
  }

  const contextSize = Math.max(1, config.contextMessages)

  for (const message of history.slice(-contextSize)) {
    if (message.role !== 'user' && message.role !== 'assistant') continue

    if (!message.content.trim()) continue

    messages.push({
      role: message.role,
      content: message.content,
    })
  }

  return messages
}

export async function testChatConnection(config: ChatConfig) {
  const endpoint = config.endpoint.trim()
  const model = config.model.trim()

  if (!endpoint || !model) {
    throw new ChatApiError('http', '请先填写接口地址和模型名')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`
  }

  const response = await doFetch(endpoint, {
    method: 'POST',
    headers,
    connectTimeout: 30000,
    body: JSON.stringify({
      model,
      stream: false,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  }).catch(() => {
    throw new ChatApiError('network', '无法连接到模型服务，请检查网络和接口地址', undefined)
  })

  const text = await response.text()

  if (!response.ok) {
    throw new ChatApiError('http', getHttpErrorMessage(response.status, text), response.status)
  }

  let payload: unknown

  try {
    payload = JSON.parse(text)
  } catch {
    throw new ChatApiError('http', '模型服务返回了无法解析的内容')
  }

  const apiError = getPayloadError(payload)

  if (apiError) {
    throw new ChatApiError('http', apiError, response.status)
  }

  return getPayloadContent(payload) ?? '连接成功'
}

export async function streamChatCompletion(
  config: ChatConfig,
  history: ChatMessage[],
  onDelta: (content: string) => void,
  signal?: AbortSignal,
) {
  const endpoint = config.endpoint.trim()
  const model = config.model.trim()

  if (!endpoint || !model) {
    throw new ChatApiError('http', '请先填写接口地址和模型名')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`
  }

  let response: Response

  try {
    response = await doFetch(endpoint, {
      method: 'POST',
      headers,
      signal,
      connectTimeout: 30000,
      body: JSON.stringify({
        model,
        stream: true,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages: buildChatMessages(config, history),
      }),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ChatApiError('aborted', '已停止生成')
    }

    throw new ChatApiError('network', '无法连接到模型服务，请检查网络和接口地址')
  }

  if (!response.ok) {
    const text = await response.text()

    throw new ChatApiError('http', getHttpErrorMessage(response.status, text), response.status)
  }

  if (!response.body) {
    throw new ChatApiError('stream', '模型服务未返回数据')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleLine = (line: string): boolean => {
    if (!line.startsWith('data:')) return true

    const data = line.slice(5).trim()

    if (!data) return true

    if (data === '[DONE]') return false

    let payload: unknown

    try {
      payload = JSON.parse(data)
    } catch {
      return true
    }

    const apiError = getPayloadError(payload)

    if (apiError) {
      throw new ChatApiError('stream', apiError)
    }

    const content = getPayloadContent(payload)

    if (content) onDelta(content)

    return true
  }

  const processBuffer = (): boolean => {
    let newlineIndex = buffer.indexOf('\n')

    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim()

      buffer = buffer.slice(newlineIndex + 1)

      if (!handleLine(line)) return false

      newlineIndex = buffer.indexOf('\n')
    }

    return true
  }

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      if (!processBuffer()) break
    }

    if (buffer.trim()) {
      const data = buffer.trim()

      if (data.startsWith('data:')) {
        handleLine(data)
      }
    }
  } catch (error) {
    if (error instanceof ChatApiError) throw error

    if (error instanceof Error && error.name === 'AbortError') {
      throw new ChatApiError('aborted', '已停止生成')
    }

    throw new ChatApiError('stream', '读取模型回复时发生错误')
  } finally {
    reader.releaseLock()
  }
}
