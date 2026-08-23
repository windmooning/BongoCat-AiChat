<script setup lang="ts">
import { LogicalSize } from '@tauri-apps/api/dpi'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { computed, ref, watch } from 'vue'

import { useTauriListen } from '@/composables/useTauriListen'
import { LISTEN_KEY } from '@/constants'
import { hideCatBubbleWindow, showChatWindow } from '@/plugins/window'
import { useCatStore } from '@/stores/cat'
import { useChatStore } from '@/stores/chat'

interface CatBubbleContent {
  catName: string
  mood: string
  hint?: string
}

const chatStore = useChatStore()
const catStore = useCatStore()
const appWindow = getCurrentWebviewWindow()
const catName = ref('')
const mood = ref('')
const hint = ref('')

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function hexToRgb(hex: unknown) {
  if (typeof hex !== 'string') return [255, 255, 255]

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
  return getLuminance(catStore.bubble.appearance.backgroundColor) > 0.6
})

const rootStyle = computed<Record<string, string>>(() => ({
  '--bubble-font-size': `${catStore.bubble.appearance.fontSize}px`,
}))

const bubbleBackground = computed(() => {
  const [red, green, blue] = hexToRgb(catStore.bubble.appearance.backgroundColor)
  const alpha = clamp(catStore.bubble.appearance.backgroundOpacity, 0, 100) / 100

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
})

const textColor = computed(() => isLightBackground.value ? '#333333' : '#ffffff')
const secondaryColor = computed(() => {
  return isLightBackground.value ? '#8a8a8a' : 'rgba(255, 255, 255, 0.7)'
})

watch(
  [
    () => catStore.bubble.appearance.width,
    () => catStore.bubble.appearance.height,
  ],
  async ([width, height]) => {
    await appWindow.setSize(new LogicalSize(
      clamp(width, 180, 360),
      clamp(height, 72, 180),
    ))
  },
  { immediate: true },
)

useTauriListen<CatBubbleContent>(LISTEN_KEY.CAT_BUBBLE_CONTENT, ({ payload }) => {
  catName.value = payload.catName
  mood.value = payload.mood
  hint.value = payload.hint ?? ''
})

function handleClick() {
  emit(LISTEN_KEY.CAT_INTERACTION)
  hideCatBubbleWindow()
  showChatWindow(chatStore.config.appearance.followCat)
}
</script>

<template>
  <div
    class="size-screen overflow-visible p-1"
    :style="rootStyle"
    @click="handleClick"
  >
    <div
      v-if="mood"
      class="cat-bubble relative h-full w-full"
    >
      <div
        class="absolute inset-x-1 bottom-4 top-1 cursor-pointer px-3 py-2"
        :style="{
          backgroundColor: bubbleBackground,
          borderRadius: `${catStore.bubble.appearance.borderRadius}px`,
          boxShadow: catStore.bubble.appearance.shadow
            ? '0 4px 14px rgba(0, 0, 0, 0.18)'
            : 'none',
        }"
      >
        <div
          class="truncate font-medium"
          :style="{ color: secondaryColor, fontSize: 'calc(var(--bubble-font-size) * 0.8)' }"
        >
          {{ catName }}
        </div>

        <div
          class="line-clamp-2 mt-0.5 break-words leading-5"
          :style="{ color: textColor, fontSize: 'var(--bubble-font-size)' }"
        >
          {{ mood }}
        </div>

        <div
          v-if="hint"
          class="mt-0.5 truncate"
          :style="{ color: secondaryColor, fontSize: 'calc(var(--bubble-font-size) * 0.8)' }"
        >
          {{ hint }}
        </div>

        <i
          class="i-solar:paw-linear absolute bottom-1.5 right-2 text-5"
          :style="{ color: '#f48fb1' }"
        />
      </div>

      <div
        class="absolute bottom-0 left-1/2 size-3.5 rotate-45 -translate-x-1/2"
        :style="{ backgroundColor: bubbleBackground }"
      />
    </div>
  </div>
</template>

<style scoped>
.cat-bubble {
  animation: cat-bubble-in 180ms ease-out;
}

@keyframes cat-bubble-in {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(4px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cat-bubble {
    animation: none;
  }
}
</style>
