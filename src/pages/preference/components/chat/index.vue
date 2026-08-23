<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs'
import { Button, ColorPicker, Input, InputNumber, message, Select, Slider, Switch } from 'antdv-next'
import { nanoid } from 'nanoid'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PersonaPreset } from '@/stores/chat'

import ProListItem from '@/components/pro-list-item/index.vue'
import ProList from '@/components/pro-list/index.vue'
import { useChatStore } from '@/stores/chat'
import { useModelStore } from '@/stores/model'
import { ChatApiError, testChatConnection } from '@/utils/llm'
import { join } from '@/utils/path'

const chatStore = useChatStore()
const modelStore = useModelStore()
const { t } = useI18n()

const testing = ref(false)
const testResult = ref<'success' | 'error'>()
const testMessage = ref('')
const uploadingBackground = ref(false)

const presetOptions = computed(() => [
  {
    label: t('pages.preference.chat.options.catgirl'),
    value: 'catgirl',
  },
  {
    label: t('pages.preference.chat.options.cat'),
    value: 'cat',
  },
  {
    label: t('pages.preference.chat.options.custom'),
    value: 'custom',
  },
])

const backgroundOptions = computed(() => {
  const options = [
    {
      id: 'logo',
      src: '/logo.png',
      label: t('pages.preference.chat.options.logoBackground'),
    },
  ]

  for (const model of modelStore.models.filter(item => item.isPreset)) {
    options.push({
      id: `model:${model.mode}`,
      src: convertFileSrc(join(model.path, 'resources', 'cover.png')),
      label: t(`pages.preference.chat.options.model_${model.mode}`),
    })
  }

  for (const image of chatStore.backgroundImages) {
    options.push({
      id: image.id,
      src: convertFileSrc(image.path),
      label: image.name,
    })
  }

  return options
})

async function handleUploadBackground() {
  if (uploadingBackground.value) return

  const selected = await open({
    multiple: false,
    filters: [{
      name: 'Images',
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    }],
  })

  if (!selected || Array.isArray(selected)) return

  uploadingBackground.value = true

  try {
    const bytes = await readFile(selected)
    const extension = selected.split('.').pop()?.toLowerCase() ?? 'png'
    const id = nanoid()
    const directory = join(await appDataDir(), 'chat-backgrounds')

    await mkdir(directory, { recursive: true })

    const targetPath = join(directory, `${id}.${extension}`)

    await writeFile(targetPath, bytes)

    chatStore.backgroundImages.push({
      id,
      path: targetPath,
      name: selected.split(/[\\/]/).pop() ?? t('pages.preference.chat.options.customBackground'),
    })

    chatStore.config.appearance.backgroundImageId = id
    message.success(t('pages.preference.chat.hints.backgroundUploadSuccess'))
  } catch (error) {
    message.error(String(error))
  } finally {
    uploadingBackground.value = false
  }
}

async function handleTestConnection() {
  if (testing.value) return

  testing.value = true
  testResult.value = undefined
  testMessage.value = ''

  try {
    await testChatConnection(chatStore.config)

    testResult.value = 'success'
    testMessage.value = t('pages.preference.chat.hints.testSuccess')

    message.success(t('pages.preference.chat.hints.testSuccess'))
  } catch (error) {
    testResult.value = 'error'
    testMessage.value = error instanceof ChatApiError
      ? error.message
      : t('pages.preference.chat.hints.testFailed')

    message.error(testMessage.value)
  } finally {
    testing.value = false
  }
}

function handleClearHistory() {
  chatStore.clearMessages()
  message.success(t('pages.preference.chat.hints.clearSuccess'))
}

function handlePresetChange(value: unknown) {
  chatStore.applyPreset(value as PersonaPreset)
}

function handleResetAppearance() {
  chatStore.resetAppearance()
}
</script>

<template>
  <ProList :title="$t('pages.preference.chat.labels.basicSettings')">
    <ProListItem :title="$t('pages.preference.chat.labels.enableChat')">
      <Switch v-model:checked="chatStore.config.enabled" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.endpoint')"
      :title="$t('pages.preference.chat.labels.endpoint')"
      vertical
    >
      <Input
        v-model:value="chatStore.config.endpoint"
        :placeholder="$t('pages.preference.chat.placeholders.endpoint')"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.apiKey')"
      :title="$t('pages.preference.chat.labels.apiKey')"
      vertical
    >
      <Input.Password
        v-model:value="chatStore.config.apiKey"
        :placeholder="$t('pages.preference.chat.placeholders.apiKey')"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.model')"
      :title="$t('pages.preference.chat.labels.model')"
      vertical
    >
      <Input
        v-model:value="chatStore.config.model"
        :placeholder="$t('pages.preference.chat.placeholders.model')"
      />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.chat.labels.testConnection')">
      <div class="flex items-center gap-3">
        <span
          v-if="testResult"
          class="text-3"
          :class="testResult === 'success' ? 'color-success' : 'color-red-5'"
        >
          {{ testMessage }}
        </span>

        <Button
          :loading="testing"
          @click="handleTestConnection"
        >
          {{ $t('pages.preference.chat.labels.testConnection') }}
        </Button>
      </div>
    </ProListItem>
  </ProList>

  <ProList :title="$t('pages.preference.chat.labels.replySettings')">
    <ProListItem
      :description="$t('pages.preference.chat.hints.temperature')"
      :title="$t('pages.preference.chat.labels.temperature')"
      vertical
    >
      <Slider
        v-model:value="chatStore.config.temperature"
        class="m-0!"
        :max="2"
        :min="0"
        :step="0.1"
        :tooltip="{
          formatter(value) {
            return value
          },
        }"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.maxTokens')"
      :title="$t('pages.preference.chat.labels.maxTokens')"
    >
      <InputNumber
        v-model:value="chatStore.config.maxTokens"
        class="w-24"
        :max="32768"
        :min="1"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.contextMessages')"
      :title="$t('pages.preference.chat.labels.contextMessages')"
    >
      <InputNumber
        v-model:value="chatStore.config.contextMessages"
        class="w-24"
        :max="100"
        :min="1"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.replySuffix')"
      :title="$t('pages.preference.chat.labels.replySuffix')"
      vertical
    >
      <Input
        v-model:value="chatStore.config.replySuffix"
        :placeholder="$t('pages.preference.chat.placeholders.replySuffix')"
      />
    </ProListItem>
  </ProList>

  <ProList :title="$t('pages.preference.chat.labels.personaSettings')">
    <ProListItem
      :description="$t('pages.preference.chat.hints.catName')"
      :title="$t('pages.preference.chat.labels.catName')"
    >
      <Input
        v-model:value="chatStore.config.catName"
        class="w-40"
        :maxlength="20"
        :placeholder="$t('pages.preference.chat.placeholders.catName')"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.personaPreset')"
      :title="$t('pages.preference.chat.labels.personaPreset')"
    >
      <Select
        class="w-40"
        :options="presetOptions"
        :value="chatStore.config.personaPreset"
        @change="handlePresetChange"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.systemPrompt')"
      :title="$t('pages.preference.chat.labels.systemPrompt')"
      vertical
    >
      <Input.TextArea
        v-model:value="chatStore.config.systemPrompt"
        :auto-size="{ minRows: 4, maxRows: 10 }"
        :placeholder="$t('pages.preference.chat.placeholders.systemPrompt')"
      />
    </ProListItem>
  </ProList>

  <ProList :title="$t('pages.preference.chat.labels.appearanceSettings')">
    <ProListItem
      :description="$t('pages.preference.chat.hints.followCat')"
      :title="$t('pages.preference.chat.labels.followCat')"
    >
      <Switch v-model:checked="chatStore.config.appearance.followCat" />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.chat.labels.chatWidth')">
      <InputNumber
        v-model:value="chatStore.config.appearance.width"
        class="w-24"
        :max="800"
        :min="280"
      />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.chat.labels.chatHeight')">
      <InputNumber
        v-model:value="chatStore.config.appearance.height"
        class="w-24"
        :max="900"
        :min="320"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.backgroundColor')"
      :title="$t('pages.preference.chat.labels.backgroundColor')"
    >
      <div class="flex items-center gap-3">
        <ColorPicker
          v-model:value="chatStore.config.appearance.backgroundColor"
          :disabled-alpha="true"
          format="hex"
          value-format="hex"
        />

        <Input
          v-model:value="chatStore.config.appearance.backgroundColor"
          class="w-30"
        />
      </div>
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.backgroundImage')"
      :title="$t('pages.preference.chat.labels.backgroundImage')"
      vertical
    >
      <div class="flex flex-wrap gap-3">
        <button
          v-for="option in backgroundOptions"
          :key="option.id"
          class="w-24 flex flex-col items-center gap-1 b-1 b-solid p-1 transition rounded-lg"
          :class="chatStore.config.appearance.backgroundImageId === option.id
            ? 'border-blue-5'
            : 'border-transparent hover:border-[--ant-color-border]'"
          type="button"
          @click="chatStore.config.appearance.backgroundImageId = option.id"
        >
          <img
            class="size-16 object-cover rounded-md"
            :src="option.src"
          >

          <span class="max-w-full truncate text-2.5 color-text-tertiary">
            {{ option.label }}
          </span>
        </button>

        <Button
          class="h-24 w-24"
          :loading="uploadingBackground"
          @click="handleUploadBackground"
        >
          {{ $t('pages.preference.chat.labels.uploadBackground') }}
        </Button>
      </div>
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.backgroundOpacity')"
      :title="$t('pages.preference.chat.labels.backgroundOpacity')"
      vertical
    >
      <Slider
        v-model:value="chatStore.config.appearance.backgroundOpacity"
        class="m-0!"
        :max="100"
        :min="0"
        :tooltip="{
          formatter(value) {
            return `${value}%`
          },
        }"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.chat.hints.fontSize')"
      :title="$t('pages.preference.chat.labels.fontSize')"
      vertical
    >
      <Slider
        v-model:value="chatStore.config.appearance.fontSize"
        class="m-0!"
        :max="24"
        :min="12"
        :step="1"
        :tooltip="{
          formatter(value) {
            return `${value}px`
          },
        }"
      />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.chat.labels.resetAppearance')">
      <Button @click="handleResetAppearance">
        {{ $t('pages.preference.chat.labels.resetAppearance') }}
      </Button>
    </ProListItem>
  </ProList>

  <ProList :title="$t('pages.preference.chat.labels.messageBubbleSettings')">
    <ProListItem :title="$t('pages.preference.chat.labels.userBubbleBackground')">
      <div class="flex items-center gap-3">
        <ColorPicker
          v-model:value="chatStore.config.appearance.messageBubbles.user.backgroundColor"
          :disabled-alpha="true"
          format="hex"
          value-format="hex"
        />

        <Input
          v-model:value="chatStore.config.appearance.messageBubbles.user.backgroundColor"
          class="w-24"
        />
      </div>
    </ProListItem>

    <ProListItem
      :title="$t('pages.preference.chat.labels.userBubbleOpacity')"
      vertical
    >
      <Slider
        v-model:value="chatStore.config.appearance.messageBubbles.user.backgroundOpacity"
        class="m-0!"
        :max="100"
        :min="0"
      />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.chat.labels.userBubbleTextColor')">
      <div class="flex items-center gap-3">
        <ColorPicker
          v-model:value="chatStore.config.appearance.messageBubbles.user.textColor"
          :disabled-alpha="true"
          format="hex"
          value-format="hex"
        />

        <Input
          v-model:value="chatStore.config.appearance.messageBubbles.user.textColor"
          class="w-24"
        />
      </div>
    </ProListItem>

    <ProListItem :title="$t('pages.preference.chat.labels.assistantBubbleBackground')">
      <div class="flex items-center gap-3">
        <ColorPicker
          v-model:value="chatStore.config.appearance.messageBubbles.assistant.backgroundColor"
          :disabled-alpha="true"
          format="hex"
          value-format="hex"
        />

        <Input
          v-model:value="chatStore.config.appearance.messageBubbles.assistant.backgroundColor"
          class="w-24"
        />
      </div>
    </ProListItem>

    <ProListItem
      :title="$t('pages.preference.chat.labels.assistantBubbleOpacity')"
      vertical
    >
      <Slider
        v-model:value="chatStore.config.appearance.messageBubbles.assistant.backgroundOpacity"
        class="m-0!"
        :max="100"
        :min="0"
      />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.chat.labels.assistantBubbleTextColor')">
      <div class="flex items-center gap-3">
        <ColorPicker
          v-model:value="chatStore.config.appearance.messageBubbles.assistant.textColor"
          :disabled-alpha="true"
          format="hex"
          value-format="hex"
        />

        <Input
          v-model:value="chatStore.config.appearance.messageBubbles.assistant.textColor"
          class="w-24"
        />
      </div>
    </ProListItem>
  </ProList>

  <ProList :title="$t('pages.preference.chat.labels.dataSettings')">
    <ProListItem
      :description="$t('pages.preference.chat.hints.clearHistory')"
      :title="$t('pages.preference.chat.labels.clearHistory')"
    >
      <Button
        danger
        @click="handleClearHistory"
      >
        {{ $t('pages.preference.chat.labels.clearHistory') }}
      </Button>
    </ProListItem>
  </ProList>
</template>
