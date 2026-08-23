import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

import type { WINDOW_LABEL } from '../constants'

import { LISTEN_KEY } from '../constants'

export type WindowLabel = typeof WINDOW_LABEL[keyof typeof WINDOW_LABEL]

const COMMAND = {
  SHOW_WINDOW: 'plugin:custom-window|show_window',
  HIDE_WINDOW: 'plugin:custom-window|hide_window',
  SHOW_CHAT_WINDOW: 'plugin:custom-window|show_chat_window_command',
  HIDE_CHAT_WINDOW: 'plugin:custom-window|hide_chat_window',
  TOGGLE_CHAT_WINDOW: 'plugin:custom-window|toggle_chat_window',
  REPOSITION_CHAT_WINDOW: 'plugin:custom-window|reposition_chat_window',
  SHOW_CAT_BUBBLE: 'plugin:custom-window|show_cat_bubble_window_command',
  HIDE_CAT_BUBBLE: 'plugin:custom-window|hide_cat_bubble_window',
  SET_ALWAYS_ON_TOP: 'plugin:custom-window|set_always_on_top',
  SET_TASKBAR_VISIBILITY: 'plugin:custom-window|set_taskbar_visibility',
}

export function showWindow(label?: WindowLabel) {
  if (label) {
    emit(LISTEN_KEY.SHOW_WINDOW, label)
  } else {
    invoke(COMMAND.SHOW_WINDOW)
  }
}

export function hideWindow(label?: WindowLabel) {
  if (label) {
    emit(LISTEN_KEY.HIDE_WINDOW, label)
  } else {
    invoke(COMMAND.HIDE_WINDOW)
  }
}

export function showChatWindow(followCat = true) {
  invoke(COMMAND.SHOW_CHAT_WINDOW, { followCat })
}

export function hideChatWindow() {
  invoke(COMMAND.HIDE_CHAT_WINDOW)
}

export async function toggleChatWindow(followCat = true) {
  return invoke<boolean>(COMMAND.TOGGLE_CHAT_WINDOW, { followCat })
}

export function repositionChatWindow() {
  invoke(COMMAND.REPOSITION_CHAT_WINDOW)
}

export function showCatBubbleWindow() {
  invoke(COMMAND.SHOW_CAT_BUBBLE)
}

export function hideCatBubbleWindow() {
  invoke(COMMAND.HIDE_CAT_BUBBLE)
}

export function setAlwaysOnTop(alwaysOnTop: boolean) {
  invoke(COMMAND.SET_ALWAYS_ON_TOP, { alwaysOnTop })
}

export async function toggleWindowVisible(label?: WindowLabel) {
  const appWindow = getCurrentWebviewWindow()

  if (appWindow.label !== label) return

  const visible = await appWindow.isVisible()

  if (visible) {
    return hideWindow(label)
  }

  return showWindow(label)
}

export async function setTaskbarVisibility(visible: boolean) {
  invoke(COMMAND.SET_TASKBAR_VISIBILITY, { visible })
}
