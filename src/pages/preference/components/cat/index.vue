<script setup lang="ts">
import { ColorPicker, Divider, Flex, Input, InputNumber, Slider, SpaceAddon, SpaceCompact, Switch } from 'antdv-next'

import ProListItem from '@/components/pro-list-item/index.vue'
import ProList from '@/components/pro-list/index.vue'
import { useCatStore } from '@/stores/cat'
import { isWindows } from '@/utils/platform'

const catStore = useCatStore()
</script>

<template>
  <ProList :title="$t('pages.preference.cat.labels.modelSettings')">
    <ProListItem
      :description="$t('pages.preference.cat.hints.mirrorMode')"
      :title="$t('pages.preference.cat.labels.mirrorMode')"
    >
      <Switch v-model:checked="catStore.model.mirror" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.mouseMirror')"
      :title="$t('pages.preference.cat.labels.mouseMirror')"
    >
      <Switch v-model:checked="catStore.model.mouseMirror" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.ignoreMouse')"
      :title="$t('pages.preference.cat.labels.ignoreMouse')"
    >
      <Switch v-model:checked="catStore.model.ignoreMouse" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.hoverBubbleDelay')"
      :title="$t('pages.preference.cat.labels.hoverBubbleDelay')"
    >
      <SpaceCompact>
        <InputNumber
          v-model:value="catStore.window.hoverBubbleDelay"
          class="w-20"
          :max="5000"
          :min="500"
          :step="100"
        />

        <SpaceAddon>ms</SpaceAddon>
      </SpaceCompact>
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.motionSound')"
      :title="$t('pages.preference.cat.labels.motionSound')"
    >
      <Switch v-model:checked="catStore.model.motionSound" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.behavior')"
      :title="$t('pages.preference.cat.labels.behavior')"
    >
      <Switch v-model:checked="catStore.model.behavior" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.autoBehavior')"
      :title="$t('pages.preference.cat.labels.autoBehavior')"
    >
      <Switch v-model:checked="catStore.model.autoBehavior" />
    </ProListItem>

    <ProListItem
      v-if="isWindows"
      :description="$t('pages.preference.cat.hints.autoReleaseDelay')"
      :title="$t('pages.preference.cat.labels.autoReleaseDelay')"
    >
      <SpaceCompact>
        <InputNumber
          v-model:value="catStore.model.autoReleaseDelay"
          class="w-20"
        />

        <SpaceAddon>s</SpaceAddon>
      </SpaceCompact>
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.maxFPS')"
      :title="$t('pages.preference.cat.labels.maxFPS')"
    >
      <InputNumber
        v-model:value="catStore.model.maxFPS"
        class="w-20"
        :min="0"
      />
    </ProListItem>
  </ProList>

  <ProList :title="$t('pages.preference.cat.labels.bubbleAppearance')">
    <ProListItem :title="$t('pages.preference.cat.labels.bubbleWidth')">
      <InputNumber
        v-model:value="catStore.bubble.appearance.width"
        class="w-24"
        :max="360"
        :min="180"
      />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.cat.labels.bubbleHeight')">
      <InputNumber
        v-model:value="catStore.bubble.appearance.height"
        class="w-24"
        :max="180"
        :min="72"
      />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.cat.labels.bubbleBackgroundColor')">
      <div class="flex items-center gap-3">
        <ColorPicker
          v-model:value="catStore.bubble.appearance.backgroundColor"
          :disabled-alpha="true"
          format="hex"
          value-format="hex"
        />

        <Input
          v-model:value="catStore.bubble.appearance.backgroundColor"
          class="w-30"
        />
      </div>
    </ProListItem>

    <ProListItem
      :title="$t('pages.preference.cat.labels.bubbleOpacity')"
      vertical
    >
      <Slider
        v-model:value="catStore.bubble.appearance.backgroundOpacity"
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
      :title="$t('pages.preference.cat.labels.bubbleFontSize')"
      vertical
    >
      <Slider
        v-model:value="catStore.bubble.appearance.fontSize"
        class="m-0!"
        :max="18"
        :min="10"
        :step="1"
        :tooltip="{
          formatter(value) {
            return `${value}px`
          },
        }"
      />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.cat.labels.bubbleRadius')">
      <InputNumber
        v-model:value="catStore.bubble.appearance.borderRadius"
        class="w-24"
        :max="28"
        :min="12"
      />
    </ProListItem>

    <ProListItem :title="$t('pages.preference.cat.labels.bubbleShadow')">
      <Switch v-model:checked="catStore.bubble.appearance.shadow" />
    </ProListItem>
  </ProList>

  <ProList :title="$t('pages.preference.cat.labels.bubblePhrases')">
    <ProListItem
      :description="$t('pages.preference.cat.hints.customPhrases')"
      :title="$t('pages.preference.cat.labels.bubbleIdleMorning')"
      vertical
    >
      <Input.TextArea
        v-model:value="catStore.bubble.customPhrases.idleMorning"
        :auto-size="{ minRows: 2, maxRows: 4 }"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.customPhrases')"
      :title="$t('pages.preference.cat.labels.bubbleIdleAfternoon')"
      vertical
    >
      <Input.TextArea
        v-model:value="catStore.bubble.customPhrases.idleAfternoon"
        :auto-size="{ minRows: 2, maxRows: 4 }"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.customPhrases')"
      :title="$t('pages.preference.cat.labels.bubbleIdleNight')"
      vertical
    >
      <Input.TextArea
        v-model:value="catStore.bubble.customPhrases.idleNight"
        :auto-size="{ minRows: 2, maxRows: 4 }"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.customPhrases')"
      :title="$t('pages.preference.cat.labels.bubbleBored')"
      vertical
    >
      <Input.TextArea
        v-model:value="catStore.bubble.customPhrases.bored"
        :auto-size="{ minRows: 2, maxRows: 4 }"
      />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.customPhrases')"
      :title="$t('pages.preference.cat.labels.bubbleSleepy')"
      vertical
    >
      <Input.TextArea
        v-model:value="catStore.bubble.customPhrases.sleepy"
        :auto-size="{ minRows: 2, maxRows: 4 }"
      />
    </ProListItem>
  </ProList>

  <ProList :title="$t('pages.preference.cat.labels.windowSettings')">
    <ProListItem
      :description="$t('pages.preference.cat.hints.passThrough')"
      :title="$t('pages.preference.cat.labels.passThrough')"
    >
      <Switch v-model:checked="catStore.window.passThrough" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.alwaysOnTop')"
      :title="$t('pages.preference.cat.labels.alwaysOnTop')"
    >
      <Switch v-model:checked="catStore.window.alwaysOnTop" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.hideOnHover')"
      :title="$t('pages.preference.cat.labels.hideOnHover')"
    >
      <Flex align="center">
        <Switch v-model:checked="catStore.window.hideOnHover" />

        <Flex
          align="center"
          class="overflow-hidden transition-all"
          :class="[catStore.window.hideOnHover ? 'w-28 opacity-100' : 'w-0 opacity-0']"
        >
          <Divider type="vertical" />

          <SpaceCompact>
            <InputNumber
              v-model:value="catStore.window.hideOnHoverDelay"
              class="w-16"
              :min="0"
            />

            <SpaceAddon>s</SpaceAddon>
          </SpaceCompact>
        </Flex>
      </Flex>
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.keepInScreen')"
      :title="$t('pages.preference.cat.labels.keepInScreen')"
    >
      <Switch v-model:checked="catStore.window.keepInScreen" />
    </ProListItem>

    <ProListItem
      :description="$t('pages.preference.cat.hints.windowSize')"
      :title="$t('pages.preference.cat.labels.windowSize')"
    >
      <SpaceCompact>
        <InputNumber
          v-model:value="catStore.window.scale"
          class="w-20"
          :max="500"
          :min="1"
        />

        <SpaceAddon>%</SpaceAddon>
      </SpaceCompact>
    </ProListItem>

    <ProListItem :title="$t('pages.preference.cat.labels.windowRadius')">
      <SpaceCompact>
        <InputNumber
          v-model:value="catStore.window.radius"
          class="w-20"
          :min="0"
        />

        <SpaceAddon>%</SpaceAddon>
      </SpaceCompact>
    </ProListItem>

    <ProListItem
      :title="$t('pages.preference.cat.labels.opacity')"
      vertical
    >
      <Slider
        v-model:value="catStore.window.opacity"
        class="m-0!"
        :max="100"
        :min="10"
        :tooltip="{
          formatter(value) {
            return `${value}%`
          },
        }"
      />
    </ProListItem>
  </ProList>
</template>
