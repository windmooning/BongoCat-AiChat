import type { Ref } from 'vue'

import { useNow } from '@vueuse/core'
import { computed } from 'vue'

interface ChatStatusOptions {
  isStreaming: Ref<boolean>
  streamingContent: Ref<string>
  errorText: Ref<string>
  isConfigured: Ref<boolean>
}

export function useChatStatus(options: ChatStatusOptions) {
  const now = useNow({ interval: 30_000 })

  const statusKey = computed(() => {
    if (options.errorText.value) {
      return 'pages.chat.status.error'
    }

    if (!options.isConfigured.value) {
      return 'pages.chat.status.unconfigured'
    }

    if (options.isStreaming.value) {
      return options.streamingContent.value
        ? 'pages.chat.status.replying'
        : 'pages.chat.status.thinking'
    }

    const hour = now.value.getHours()

    if (hour >= 5 && hour < 12) {
      return 'pages.chat.status.idleMorning'
    }

    if (hour >= 12 && hour < 18) {
      return 'pages.chat.status.idleAfternoon'
    }

    return 'pages.chat.status.idleNight'
  })

  return {
    statusKey,
  }
}
