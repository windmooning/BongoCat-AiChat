import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

function normalizeHexColor(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback

  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
    ? value
    : fallback
}

export interface CatStore {
  model: {
    mirror: boolean
    mouseMirror: boolean
    motionSound: boolean
    behavior: boolean
    autoReleaseDelay: number
    maxFPS: number
    ignoreMouse: boolean
    autoBehavior: boolean
  }
  window: {
    visible: boolean
    passThrough: boolean
    alwaysOnTop: boolean
    scale: number
    opacity: number
    radius: number
    hideOnHover: boolean
    hideOnHoverDelay: number
    hoverBubbleDelay: number
    keepInScreen: boolean
  }
  bubble: {
    appearance: {
      width: number
      height: number
      backgroundColor: string
      backgroundOpacity: number
      fontSize: number
      borderRadius: number
      shadow: boolean
    }
    customPhrases: {
      idleMorning: string
      idleAfternoon: string
      idleNight: string
      bored: string
      sleepy: string
    }
  }
}

export const useCatStore = defineStore('cat', () => {
  /* ------------ 废弃字段（后续删除） ------------ */

  /** @deprecated 请使用 `model.mirror` */
  const mirrorMode = ref(false)

  /** @deprecated 请使用 `model.mouseMirror` */
  const mouseMirror = ref(false)

  /** @deprecated 请使用 `window.passThrough` */
  const penetrable = ref(false)

  /** @deprecated 请使用 `window.alwaysOnTop` */
  const alwaysOnTop = ref(true)

  /** @deprecated 请使用 `window.scale` */
  const scale = ref(100)

  /** @deprecated 请使用 `window.opacity` */
  const opacity = ref(100)

  /** @deprecated 用于标识数据是否已迁移，后续版本将删除 */
  const migrated = ref(false)

  const model = reactive<CatStore['model']>({
    mirror: false,
    mouseMirror: false,
    motionSound: true,
    behavior: true,
    autoReleaseDelay: 3,
    maxFPS: 60,
    ignoreMouse: false,
    autoBehavior: true,
  })

  const window = reactive<CatStore['window']>({
    visible: true,
    passThrough: false,
    alwaysOnTop: false,
    scale: 100,
    opacity: 100,
    radius: 0,
    hideOnHover: false,
    hideOnHoverDelay: 0,
    hoverBubbleDelay: 1500,
    keepInScreen: true,
  })

  const bubble = reactive<CatStore['bubble']>({
    appearance: {
      width: 240,
      height: 108,
      backgroundColor: '#ffffff',
      backgroundOpacity: 100,
      fontSize: 13,
      borderRadius: 18,
      shadow: true,
    },
    customPhrases: {
      idleMorning: '',
      idleAfternoon: '',
      idleNight: '',
      bored: '',
      sleepy: '',
    },
  })

  const init = () => {
    if (!migrated.value) {
      model.mirror = mirrorMode.value
      model.mouseMirror = mouseMirror.value
      model.autoBehavior = true

      window.visible = true
      window.passThrough = penetrable.value
      window.alwaysOnTop = alwaysOnTop.value
      window.scale = scale.value
      window.opacity = opacity.value

      migrated.value = true
    }

    model.autoBehavior ??= true
    window.hoverBubbleDelay ??= 1500

    if (bubble) {
      bubble.appearance = {
        width: bubble.appearance?.width ?? 240,
        height: bubble.appearance?.height ?? 108,
        backgroundColor: normalizeHexColor(bubble.appearance?.backgroundColor, '#ffffff'),
        backgroundOpacity: bubble.appearance?.backgroundOpacity ?? 100,
        fontSize: bubble.appearance?.fontSize ?? 13,
        borderRadius: bubble.appearance?.borderRadius ?? 18,
        shadow: bubble.appearance?.shadow ?? true,
      }

      bubble.customPhrases = {
        idleMorning: bubble.customPhrases?.idleMorning ?? '',
        idleAfternoon: bubble.customPhrases?.idleAfternoon ?? '',
        idleNight: bubble.customPhrases?.idleNight ?? '',
        bored: bubble.customPhrases?.bored ?? '',
        sleepy: bubble.customPhrases?.sleepy ?? '',
      }
    }
  }

  return {
    migrated,
    model,
    window,
    bubble,
    init,
  }
})
