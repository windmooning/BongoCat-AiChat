<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { Button, Input, Popconfirm } from 'antdv-next'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { WINDOW_LABEL } from '@/constants'
import { hideChatWindow, showWindow } from '@/plugins/window'
import { useChatStore } from '@/stores/chat'
import { ChatApiError, streamChatCompletion } from '@/utils/llm'

const chatStore = useChatStore()
const appWindow = getCurrentWebviewWindow()
const { t } = useI18n()

const input = ref('')
const errorText = ref('')
const isStreaming = ref(false)
const streamingContent = ref('')
const streamingMessageId = ref<string>()
const abortController = ref<AbortController>()
const messagesRef = ref<HTMLElement>()

const isConfigured = computed(() => chatStore.isConfigured())

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

function openPreference() {
  showWindow(WINDOW_LABEL.PREFERENCE)
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

  appWindow.onFocusChanged(({ payload }) => {
    if (!payload) return

    nextTick(() => {
      document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
    })
  })
})
</script>

<template>
  <div class="size-screen overflow-hidden p-2">
    <div
      class="h-full flex flex-col overflow-hidden b-1 b-solid bg-elevated b-border-sec rounded-2xl shadow-lg"
    >
      <div class="flex items-center justify-between border-b border-solid px-3 py-2 b-border-sec">
        <div class="flex items-center gap-2">
          <img
            class="size-7 rounded-full"
            src="/logo.png"
          >

          <span class="font-medium">{{ $t('pages.chat.title') }}</span>
        </div>

        <div class="flex items-center gap-1">
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
          class="h-full flex flex-col items-center justify-center gap-3 text-center color-text-tertiary"
        >
          <img
            class="size-14 opacity-60 rounded-full"
            src="/logo.png"
          >

          <div class="text-3">
            {{ isConfigured ? $t('pages.chat.hints.emptyChat') : $t('pages.chat.hints.setupFirst') }}
          </div>

          <Button
            v-if="!isConfigured"
            size="small"
            type="primary"
            @click="openPreference"
          >
            {{ $t('pages.chat.labels.goSettings') }}
          </Button>
        </div>

        <div
          v-for="message in displayMessages"
          :key="message.id"
          class="mb-3 flex"
          :class="[message.role === 'user' ? 'justify-end' : 'justify-start']"
        >
          <div
            class="max-w-[85%] break-words px-3 py-2 text-3.5 leading-6 rounded-xl"
            :class="message.role === 'user'
              ? 'bg-blue-5 color-white'
              : 'bg-[--ant-color-fill-quaternary] color-text-primary'"
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
