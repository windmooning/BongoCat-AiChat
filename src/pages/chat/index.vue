<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { Button, Input, Popconfirm } from 'antdv-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useChatStatus } from '@/composables/useChatStatus'
import { LISTEN_KEY } from '@/constants'
import { hideChatWindow } from '@/plugins/window'
import { useChatStore } from '@/stores/chat'
import { useModelStore } from '@/stores/model'
import { ChatApiError, streamChatCompletion } from '@/utils/llm'
import { join } from '@/utils/path'

const chatStore = useChatStore()
const modelStore = useModelStore()
const appWindow = getCurrentWebviewWindow()
const { t } = useI18n()

const input = ref('')
const errorText = ref('')
const isStreaming = ref(false)
const streamingContent = ref('')
const streamingMessageId = ref<string>()
const abortController = ref<AbortController>()
const messagesRef = ref<HTMLElement>()
const avatarFailed = ref(false)
let draggingChatWindow = false
let unlistenMoved: (() => void) | undefined

const CHAT_SIZE_LIMITS = {
  minWidth: 280,
  maxWidth: 800,
  minHeight: 320,
  maxHeight: 900,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function hexToRgb(hex: string) {
  const normalized = hex.trim().replace('#', '')
  const shortHex = /^[0-9a-f]{3}$/i.test(normalized)
  const fullHex = /^[0-9a-f]{6}$/i.test(normalized)

  if (!shortHex && !fullHex) return [255, 255, 255]

  const value = shortHex
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function getLuminance(hex: string) {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const value = channel / 255

    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!
}

const isLightBackground = computed(() => {
  return getLuminance(chatStore.config.appearance.backgroundColor) > 0.6
})

const contentColor = computed(() => {
  return isLightBackground.value ? '#1f1f1f' : '#f5f5f5'
})

const rootStyle = computed<Record<string, string>>(() => ({
  '--chat-font-size': `${chatStore.config.appearance.fontSize}px`,
}))

const cardStyle = computed(() => {
  const [red, green, blue] = hexToRgb(chatStore.config.appearance.backgroundColor)
  const alpha = clamp(chatStore.config.appearance.backgroundOpacity, 0, 100) / 100

  return {
    backgroundColor: `rgba(${red}, ${green}, ${blue}, ${alpha})`,
  }
})

const isConfigured = computed(() => chatStore.isConfigured())

const catAvatarSrc = computed(() => {
  const currentModel = modelStore.currentModel

  if (avatarFailed.value || !currentModel) return '/logo.png'

  return convertFileSrc(join(currentModel.path, 'resources', 'cover.png'))
})

const { statusKey } = useChatStatus({
  isStreaming,
  streamingContent,
  errorText,
  isConfigured,
})

watch(() => statusKey.value, (value) => {
  emit(LISTEN_KEY.CHAT_STATUS, value)
}, { immediate: true })

const canSend = computed(() => {
  return !isStreaming.value && input.value.trim().length > 0
})

const displayMessages = computed(() => {
  return chatStore.messages.map((message) => {
    if (message.id !== streamingMessageId.value) return message

    return {
      ...message,
      content: streamingContent.value,
    }
  })
})

function scrollToBottom() {
  nextTick(() => {
    const element = messagesRef.value

    if (element) {
      element.scrollTop = element.scrollHeight
    }
  })
}

function handleClose() {
  if (!isStreaming.value) {
    hideChatWindow()
  }
}

function handleAvatarError() {
  avatarFailed.value = true
}

async function handleSend() {
  const text = input.value.trim()

  if (!text || isStreaming.value) return

  if (!chatStore.config.enabled) {
    errorText.value = t('pages.chat.errors.disabled')
    return
  }

  if (!isConfigured.value) {
    errorText.value = t('pages.chat.errors.notConfigured')
    return
  }

  errorText.value = ''
  input.value = ''
  isStreaming.value = true

  chatStore.pushMessage('user', text)

  const assistantMessage = chatStore.pushMessage('assistant', '')

  streamingMessageId.value = assistantMessage.id
  streamingContent.value = ''

  const controller = new AbortController()

  abortController.value = controller

  let content = ''

  try {
    await streamChatCompletion(
      chatStore.config,
      chatStore.messages,
      (delta) => {
        content += delta
        streamingContent.value = content
      },
      controller.signal,
    )

    const suffix = chatStore.config.replySuffix.trim()

    if (suffix && content.trim() && !content.trimEnd().endsWith(suffix)) {
      content = `${content.trimEnd()}${suffix}`
    }

    if (!content.trim()) {
      content = t('pages.chat.messages.emptyReply')
    }
  } catch (error) {
    if (error instanceof ChatApiError && error.kind === 'aborted') {
      content = content.trim()
        ? `${content}${content.endsWith('\n') ? '' : '\n'}${t('pages.chat.messages.stopped')}`
        : t('pages.chat.messages.stopped')
    } else {
      const message = error instanceof ChatApiError
        ? error.message
        : t('pages.chat.errors.unknown')

      content = content.trim()
        ? `${content}\n\n${message}`
        : message
    }
  } finally {
    chatStore.updateMessage(assistantMessage.id, content)
    streamingMessageId.value = undefined
    streamingContent.value = ''
    isStreaming.value = false
    abortController.value = undefined

    scrollToBottom()
  }
}

function handleStop() {
  abortController.value?.abort()
}

function handleClearHistory() {
  chatStore.clearMessages()
  errorText.value = ''
  scrollToBottom()
}

function handleDragStart(event: MouseEvent) {
  if (event.button !== 0) return

  draggingChatWindow = true
  appWindow.startDragging()
}

function handleDragEnd() {
  setTimeout(() => {
    draggingChatWindow = false
  }, 200)
}

watch(
  [
    () => chatStore.config.appearance.width,
    () => chatStore.config.appearance.height,
  ],
  async ([width, height]) => {
    const nextWidth = clamp(width, CHAT_SIZE_LIMITS.minWidth, CHAT_SIZE_LIMITS.maxWidth)
    const nextHeight = clamp(height, CHAT_SIZE_LIMITS.minHeight, CHAT_SIZE_LIMITS.maxHeight)

    await appWindow.setSize(new LogicalSize(nextWidth, nextHeight))
  },
  { immediate: true },
)

watch(
  () => [
    chatStore.messages.length,
    chatStore.messages[chatStore.messages.length - 1]?.content,
    streamingContent.value,
  ],
  scrollToBottom,
)

onMounted(() => {
  scrollToBottom()

  appWindow.onMoved(() => {
    if (!draggingChatWindow) return

    draggingChatWindow = false
    chatStore.config.appearance.followCat = false
  }).then((unlisten) => {
    unlistenMoved = unlisten
  })

  appWindow.onFocusChanged(({ payload }) => {
    if (!payload) return

    nextTick(() => {
      document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
    })
  })
})

onUnmounted(() => {
  unlistenMoved?.()
})
</script>

<template>
  <div
    class="size-screen overflow-hidden p-2"
    :style="rootStyle"
  >
    <div
      class="h-full flex flex-col overflow-hidden b-1 b-solid bg-elevated b-border-sec rounded-2xl shadow-lg"
      :style="cardStyle"
    >
      <div class="flex items-center justify-between gap-2 border-b border-solid px-3 py-1.5 b-border-sec">
        <div
          class="min-w-0 flex flex-1 cursor-move select-none items-center gap-2"
          @mousedown="handleDragStart"
          @mouseup="handleDragEnd"
        >
          <img
            class="size-8 shrink-0 object-cover rounded-full"
            :src="catAvatarSrc"
            @error="handleAvatarError"
          >

          <div class="min-w-0">
            <div
              class="truncate text-3.5 font-medium"
              :style="{ color: contentColor }"
            >
              {{ chatStore.config.catName }}
            </div>

            <div
              class="truncate text-2.5 color-text-tertiary"
              :style="{ color: contentColor }"
            >
              {{ $t(statusKey) }}
            </div>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <Popconfirm
            :description="$t('pages.chat.hints.clearHistory')"
            placement="bottomRight"
            :title="$t('pages.chat.labels.clearHistory')"
            @confirm="handleClearHistory"
          >
            <Button
              class="!p-2"
              type="text"
            >
              <i class="i-lucide:trash-2" />
            </Button>
          </Popconfirm>

          <Button
            class="!p-2"
            type="text"
            @click="handleClose"
          >
            <i class="i-lucide:x" />
          </Button>
        </div>
      </div>

      <div
        ref="messagesRef"
        class="flex-1 overflow-y-auto px-3 py-3"
      >
        <div
          v-if="displayMessages.length === 0"
          class="h-full flex flex-col items-center justify-center gap-3 text-center"
          :style="{ color: contentColor, fontSize: 'var(--chat-font-size)' }"
        >
          <img
            class="chat-cat-float size-18 object-cover rounded-3xl"
            :src="catAvatarSrc"
            @error="handleAvatarError"
          >

          <div class="font-medium">
            {{ $t('pages.chat.empty.title') }}
          </div>

          <div class="text-3 opacity-70">
            {{ $t('pages.chat.empty.hint') }}
          </div>
        </div>

        <div
          v-for="message in displayMessages"
          :key="message.id"
          class="mb-3 flex items-end gap-2"
          :class="[message.role === 'user' ? 'justify-end' : 'justify-start']"
        >
          <img
            v-if="message.role === 'assistant'"
            class="size-6 shrink-0 object-cover rounded-full"
            :src="catAvatarSrc"
            @error="handleAvatarError"
          >

          <div
            class="max-w-[85%] break-words px-3 py-2 text-3.5 leading-6 rounded-xl"
            :class="message.role === 'user'
              ? 'bg-blue-5 color-white'
              : 'bg-[--ant-color-fill-quaternary] color-text-primary'"
            :style="message.role === 'user'
              ? { fontSize: 'var(--chat-font-size)' }
              : {
                backgroundColor: isLightBackground ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.12)',
                color: contentColor,
                fontSize: 'var(--chat-font-size)',
              }"
          >
            <span v-if="message.role === 'assistant' && isStreaming && !message.content">
              <i
                class="i-lucide:loader-circle mr-1 inline-block animate-spin"
              />
              {{ $t('pages.chat.messages.thinking') }}
            </span>

            <span
              v-else
              class="whitespace-pre-wrap"
            >
              {{ message.content }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="errorText"
        class="px-3 pb-1 text-3 color-red-5"
      >
        {{ errorText }}
      </div>

      <div class="flex items-end gap-2 border-t border-solid p-2 b-border-sec">
        <Input.TextArea
          v-model:value="input"
          :auto-size="{ minRows: 1, maxRows: 4 }"
          :disabled="isStreaming"
          :placeholder="$t('pages.chat.labels.inputPlaceholder')"
          :style="{ color: contentColor, fontSize: 'var(--chat-font-size)' }"
          @keydown.enter.exact.prevent="handleSend"
        />

        <Button
          v-if="!isStreaming"
          :disabled="!canSend"
          type="primary"
          @click="handleSend"
        >
          <i class="i-lucide:send-horizontal" />
        </Button>

        <Button
          v-else
          danger
          @click="handleStop"
        >
          <i class="i-lucide:circle-stop" />
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-cat-float {
  animation: chat-cat-float 3s ease-in-out infinite;
}

@keyframes chat-cat-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-cat-float {
    animation: none;
  }
}
</style>
