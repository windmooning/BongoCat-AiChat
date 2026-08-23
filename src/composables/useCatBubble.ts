import { emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CatBubblePhraseCategory } from '@/constants/catBubblePhrases'

import { LISTEN_KEY, WINDOW_LABEL } from '@/constants'
import {
  CAT_BUBBLE_HINTS,
  CAT_BUBBLE_PHRASES,

  getCatBubbleIdleCategory,
} from '@/constants/catBubblePhrases'
import { hideCatBubbleWindow, showCatBubbleWindow } from '@/plugins/window'
import { useAppStore } from '@/stores/app'
import { useCatStore } from '@/stores/cat'
import { useChatStore } from '@/stores/chat'
import { isMac } from '@/utils/platform'

import { useTauriListen } from './useTauriListen'

interface CursorPoint {
  x: number
  y: number
}

interface DeviceEventPayload {
  kind: string
  value?: string | CursorPoint
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

const BUBBLE_WIDTH = 240
const BUBBLE_HEIGHT = 108
const BUBBLE_GAP = 8
const HOVER_HIDE_GRACE = 400
const PROACTIVE_CHECK_INTERVAL = 5000

export function useCatBubble() {
  const appWindow = getCurrentWebviewWindow()
  const appStore = useAppStore()
  const catStore = useCatStore()
  const chatStore = useChatStore()
  const { t } = useI18n()

  const scaleFactor = ref(1)
  const mainRect = ref<Rect>()
  const isConfigured = computed(() => chatStore.isConfigured())

  const chatStatusKey = ref<string>()

  const bubbleVisible = ref(false)
  const bubbleKind = ref<'hover' | 'proactive'>()
  const lastActivityAt = ref(Date.now())
  const proactiveShown = ref(false)

  let hoverTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let proactiveTimer: ReturnType<typeof setInterval> | undefined
  let unlistenMoved: (() => void) | undefined
  let unlistenResized: (() => void) | undefined

  const canShowBubbles = computed(() => {
    return catStore.window.visible
      && !catStore.window.passThrough
      && !catStore.model.ignoreMouse
      && !catStore.window.hideOnHover
  })

  const DYNAMIC_STATUS_KEYS = new Set([
    'pages.chat.status.thinking',
    'pages.chat.status.replying',
    'pages.chat.status.error',
    'pages.chat.status.unconfigured',
  ])

  function pickRandom(items: string[]) {
    return items[Math.floor(Math.random() * items.length)] ?? ''
  }

  function getCustomPhrases(category: CatBubblePhraseCategory) {
    return catStore.bubble.customPhrases[category]
      .split('\n')
      .map(item => item.trim())
      .filter(Boolean)
  }

  function resolvePhrase(category: CatBubblePhraseCategory) {
    const customPhrases = getCustomPhrases(category)

    if (customPhrases.length > 0) {
      return pickRandom(customPhrases)
    }

    return t(pickRandom(CAT_BUBBLE_PHRASES[category]))
  }

  function resolveHint() {
    return t(pickRandom(CAT_BUBBLE_HINTS))
  }

  function getHoverContent() {
    const dynamicStatusKey = chatStatusKey.value

    if (dynamicStatusKey && DYNAMIC_STATUS_KEYS.has(dynamicStatusKey)) {
      return {
        mood: t(dynamicStatusKey),
        hint: resolveHint(),
      }
    }

    if (!isConfigured.value) {
      return {
        mood: t('pages.chat.status.unconfigured'),
        hint: resolveHint(),
      }
    }

    const category = getCatBubbleIdleCategory(new Date().getHours())

    return {
      mood: resolvePhrase(category),
      hint: resolveHint(),
    }
  }

  function clearHoverTimer() {
    if (hoverTimer) {
      clearTimeout(hoverTimer)
      hoverTimer = undefined
    }
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = undefined
    }
  }

  function hideNow() {
    clearHoverTimer()
    clearHideTimer()

    if (!bubbleVisible.value) return

    bubbleVisible.value = false
    bubbleKind.value = undefined
    emit(LISTEN_KEY.CAT_BUBBLE_MOOD, { kind: 'normal' })
    hideCatBubbleWindow()
  }

  function showBubble(
    kind: 'hover' | 'proactive',
    mood: string,
    hint?: string,
    moodKind?: 'hover' | 'bored' | 'sleepy',
  ) {
    if (!canShowBubbles.value) return

    bubbleKind.value = kind
    bubbleVisible.value = true

    emit(LISTEN_KEY.CAT_BUBBLE_CONTENT, {
      catName: chatStore.config.catName,
      mood,
      hint,
    })

    if (moodKind) {
      emit(LISTEN_KEY.CAT_BUBBLE_MOOD, { kind: moodKind })
    }

    showCatBubbleWindow()
  }

  async function refreshMainRect() {
    const position = await appWindow.outerPosition()
    const size = await appWindow.outerSize()

    mainRect.value = {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
    }
  }

  function getBubbleRect(mainRect: Rect): Rect {
    const bubbleState = appStore.windowState[WINDOW_LABEL.BUBBLE]
    const { x, y, width, height } = bubbleState ?? {}

    if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
      return { x, y, width, height }
    }

    const widthValue = BUBBLE_WIDTH * scaleFactor.value
    const heightValue = BUBBLE_HEIGHT * scaleFactor.value

    return {
      x: mainRect.x + (mainRect.width - widthValue) / 2,
      y: mainRect.y - heightValue - BUBBLE_GAP * scaleFactor.value,
      width: widthValue,
      height: heightValue,
    }
  }

  function isPointInRect(point: CursorPoint, rect: Rect) {
    return point.x >= rect.x
      && point.x <= rect.x + rect.width
      && point.y >= rect.y
      && point.y <= rect.y + rect.height
  }

  function handleCursorMove(point: CursorPoint) {
    const currentMainRect = mainRect.value

    if (!currentMainRect) return

    const cursorPoint = {
      x: point.x * scaleFactor.value,
      y: point.y * scaleFactor.value,
    }

    const insideMain = isPointInRect(cursorPoint, currentMainRect)
    const insideBubble = bubbleVisible.value
      && isPointInRect(cursorPoint, getBubbleRect(currentMainRect))

    if (insideMain) {
      clearHideTimer()

      if (!bubbleVisible.value && !hoverTimer) {
        hoverTimer = setTimeout(() => {
          const content = getHoverContent()

          showBubble('hover', content.mood, content.hint, 'hover')
        }, catStore.window.hoverBubbleDelay)
      }

      return
    }

    clearHoverTimer()

    if (insideBubble && bubbleKind.value === 'hover') {
      clearHideTimer()
      return
    }

    if (bubbleKind.value === 'hover' && !hideTimer) {
      hideTimer = setTimeout(hideNow, HOVER_HIDE_GRACE)
      return
    }

    if (bubbleKind.value === 'proactive') {
      proactiveShown.value = false
      hideNow()
    }
  }

  function checkProactive() {
    if (!canShowBubbles.value || bubbleKind.value || proactiveShown.value) return

    const now = Date.now()
    const idleDuration = now - lastActivityAt.value
    const hour = new Date(now).getHours()
    const isNight = hour >= 22 || hour < 6

    let phraseCategory: 'bored' | 'sleepy' | undefined

    if (idleDuration >= 30 * 60 * 1000 || (isNight && idleDuration >= 5 * 60 * 1000)) {
      phraseCategory = 'sleepy'
    } else if (idleDuration >= 10 * 60 * 1000) {
      phraseCategory = 'bored'
    }

    if (!phraseCategory) return

    proactiveShown.value = true
    showBubble('proactive', resolvePhrase(phraseCategory), undefined, phraseCategory)
  }

  function markInteraction() {
    lastActivityAt.value = Date.now()
    proactiveShown.value = false
    hideNow()
  }

  useTauriListen<string>(LISTEN_KEY.CHAT_STATUS, ({ payload }) => {
    chatStatusKey.value = payload
  })

  useTauriListen(LISTEN_KEY.CAT_INTERACTION, () => {
    markInteraction()
  })

  useTauriListen<DeviceEventPayload>(LISTEN_KEY.DEVICE_CHANGED, ({ payload }) => {
    lastActivityAt.value = Date.now()

    if (payload.kind !== 'MouseMove' || typeof payload.value === 'string' || !payload.value) return

    handleCursorMove(payload.value)
  })

  watch(canShowBubbles, (value) => {
    if (!value) hideNow()
  })

  onMounted(async () => {
    scaleFactor.value = isMac ? await appWindow.scaleFactor() : 1

    await refreshMainRect()

    unlistenMoved = await appWindow.onMoved(refreshMainRect)
    unlistenResized = await appWindow.onResized(refreshMainRect)

    proactiveTimer = setInterval(checkProactive, PROACTIVE_CHECK_INTERVAL)
  })

  onUnmounted(() => {
    clearHoverTimer()
    clearHideTimer()

    if (proactiveTimer) {
      clearInterval(proactiveTimer)
    }

    unlistenMoved?.()
    unlistenResized?.()
  })

  return {
    markInteraction,
  }
}
