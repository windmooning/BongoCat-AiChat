import { useNow } from '@vueuse/core'
import { computed, onUnmounted, ref, watch } from 'vue'

import { LISTEN_KEY } from '@/constants'
import {
  COMFORT_KEYWORDS,
  containsAnyKeyword,
  GREETING_KEYWORDS,
  NEGATIVE_KEYWORDS,
  PRAISE_KEYWORDS,
} from '@/constants/catBehaviorRules'
import { useCatStore } from '@/stores/cat'
import { useModelStore } from '@/stores/model'
import live2d from '@/utils/live2d'

import { useTauriListen } from './useTauriListen'

interface UserMessagePayload {
  text: string
}

interface ReplyEventPayload {
  result: 'success' | 'error' | 'stopped'
}

interface BubbleMoodPayload {
  kind: 'hover' | 'bored' | 'sleepy' | 'normal'
}

export function useCatBehavior() {
  const catStore = useCatStore()
  const modelStore = useModelStore()
  const now = useNow({ interval: 30_000 })

  const autoEnabled = computed(() => catStore.model.autoBehavior)
  const isNight = computed(() => {
    const hour = now.value.getHours()

    return hour >= 22 || hour < 6
  })

  const bubbleSleepy = ref(false)
  const errorActive = ref(false)
  const comfortUntil = ref(0)
  const coolUntil = ref(0)

  const shouldHalo = computed(() => {
    return isNight.value
      || bubbleSleepy.value
      || errorActive.value
      || comfortUntil.value > now.value.getTime()
  })

  let currentAutoExpression = -1
  let lastGreetingAt = 0
  let lastErrorMotionAt = 0
  let comfortTimer: ReturnType<typeof setTimeout> | undefined
  let coolTimer: ReturnType<typeof setTimeout> | undefined

  function getMotionGroup() {
    const matched = modelStore.currentMotions.find(([groupName]) => groupName === 'CAT_motion')
    const group = matched ?? modelStore.currentMotions[0]

    return group?.[1]
  }

  function getMotion(index: number) {
    return getMotionGroup()?.[index]
  }

  function hasExpression(index: number) {
    return index < modelStore.currentExpressions.length
  }

  function syncExpression() {
    if (!autoEnabled.value) return

    let nextExpression = 0

    if (coolUntil.value > Date.now() && hasExpression(1)) {
      nextExpression = 1
    } else if (shouldHalo.value && hasExpression(2)) {
      nextExpression = 2
    }

    if (currentAutoExpression === nextExpression) return

    currentAutoExpression = nextExpression
    live2d.setExpression(nextExpression)
  }

  function playMotion(index: number, cooldown: number, lastPlayedAt: () => number, markPlayed: () => void) {
    if (!autoEnabled.value) return

    if (Date.now() - lastPlayedAt() < cooldown) return

    const motion = getMotion(index)

    if (!motion) return

    markPlayed()
    live2d.startMotion(motion)
  }

  function playGreeting() {
    playMotion(
      1,
      3000,
      () => lastGreetingAt,
      () => {
        lastGreetingAt = Date.now()
      },
    )
  }

  function playErrorMotion() {
    playMotion(
      0,
      5000,
      () => lastErrorMotionAt,
      () => {
        lastErrorMotionAt = Date.now()
      },
    )
  }

  function triggerCool() {
    coolUntil.value = Date.now() + 8000

    if (coolTimer) clearTimeout(coolTimer)

    coolTimer = setTimeout(syncExpression, 8100)
    syncExpression()
  }

  function triggerComfort() {
    comfortUntil.value = Date.now() + 30_000

    if (comfortTimer) clearTimeout(comfortTimer)

    comfortTimer = setTimeout(syncExpression, 31_000)
    syncExpression()
  }

  function handleUserMessage(text: string) {
    if (containsAnyKeyword(text, NEGATIVE_KEYWORDS)) {
      playErrorMotion()
    }

    if (containsAnyKeyword(text, GREETING_KEYWORDS)) {
      playGreeting()
    }

    if (containsAnyKeyword(text, PRAISE_KEYWORDS)) {
      triggerCool()
    }

    if (containsAnyKeyword(text, COMFORT_KEYWORDS)) {
      triggerComfort()
    }
  }

  useTauriListen<UserMessagePayload>(LISTEN_KEY.CAT_USER_MESSAGE, ({ payload }) => {
    if (!autoEnabled.value) return

    handleUserMessage(payload.text)
  })

  useTauriListen<ReplyEventPayload>(LISTEN_KEY.CAT_REPLY_EVENT, ({ payload }) => {
    if (!autoEnabled.value) return

    if (payload.result === 'error') {
      errorActive.value = true
      playErrorMotion()
      syncExpression()
    } else if (payload.result === 'success') {
      errorActive.value = false
      syncExpression()
    }
  })

  useTauriListen<BubbleMoodPayload>(LISTEN_KEY.CAT_BUBBLE_MOOD, ({ payload }) => {
    if (!autoEnabled.value) return

    if (payload.kind === 'hover') {
      playGreeting()
      return
    }

    bubbleSleepy.value = payload.kind === 'sleepy'
    syncExpression()
  })

  useTauriListen(LISTEN_KEY.CAT_INTERACTION, () => {
    playGreeting()
  })

  watch(() => now.value.getHours(), syncExpression, { immediate: true })

  watch(() => modelStore.currentModel?.id, () => {
    currentAutoExpression = -1
    bubbleSleepy.value = false
    errorActive.value = false
    comfortUntil.value = 0
    coolUntil.value = 0
    syncExpression()
  })

  watch(() => modelStore.currentExpressions.length, syncExpression)

  watch(autoEnabled, (enabled) => {
    if (!enabled) {
      currentAutoExpression = -1

      if (hasExpression(0)) {
        live2d.setExpression(0)
      }

      return
    }

    syncExpression()
  })

  onUnmounted(() => {
    if (comfortTimer) clearTimeout(comfortTimer)
    if (coolTimer) clearTimeout(coolTimer)
  })

  return {
    handleChatOpened: playGreeting,
  }
}
