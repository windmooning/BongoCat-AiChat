<script setup lang="ts">
import { Button, Input, InputNumber, message, Select, Slider, Switch } from 'antdv-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { PersonaPreset } from '@/stores/chat'

import ProListItem from '@/components/pro-list-item/index.vue'
import ProList from '@/components/pro-list/index.vue'
import { useChatStore } from '@/stores/chat'
import { ChatApiError, testChatConnection } from '@/utils/llm'

const chatStore = useChatStore()
const { t } = useI18n()

const testing = ref(false)
const testResult = ref<'success' | 'error'>()
const testMessage = ref('')

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
