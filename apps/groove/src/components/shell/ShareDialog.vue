<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Copy, Check } from 'lucide-vue-next'
import Dialog from '@/components/ui/Dialog.vue'
import Button from '@/components/ui/Button.vue'
import { useGrooveStore } from '@/stores/groove'
import { encode } from '@/lib/codec'

const props = defineProps<{ open: boolean }>()
defineEmits<{ (e: 'update:open', v: boolean): void }>()

const store = useGrooveStore()
const { groove } = storeToRefs(store)

const payload = computed(() => encode(groove.value))
const origin = computed(() =>
  typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '',
)
const shareUrl = computed(() => `${origin.value}#/g/${payload.value}`)
const embedUrl = computed(() => `${origin.value}#/embed/g/${payload.value}`)
const iframeSnippet = computed(
  () =>
    `<iframe src="${embedUrl.value}" width="100%" height="300" frameborder="0" style="border:0" loading="lazy"></iframe>`,
)

const copied = ref<string | null>(null)
async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = key
    setTimeout(() => {
      if (copied.value === key) copied.value = null
    }, 1200)
  } catch {
    /* ignore */
  }
}
watch(
  () => props.open,
  (v) => {
    if (!v) copied.value = null
  },
)
</script>

<template>
  <Dialog :open="props.open" title="Share groove" @update:open="$emit('update:open', $event)">
    <div class="space-y-4">
      <div>
        <label class="text-xs text-muted-foreground mb-1 block">Shareable link</label>
        <div class="flex gap-2">
          <input
            class="flex-1 h-9 rounded-md border bg-background px-2 text-sm font-mono"
            readonly
            :value="shareUrl"
          />
          <Button variant="secondary" size="icon" @click="copy(shareUrl, 'url')">
            <Check v-if="copied === 'url'" class="h-4 w-4" />
            <Copy v-else class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <label class="text-xs text-muted-foreground mb-1 block">Embed (iframe)</label>
        <div class="flex gap-2">
          <textarea
            class="flex-1 min-h-[90px] rounded-md border bg-background p-2 text-xs font-mono"
            readonly
            :value="iframeSnippet"
          />
          <Button variant="secondary" size="icon" @click="copy(iframeSnippet, 'iframe')">
            <Check v-if="copied === 'iframe'" class="h-4 w-4" />
            <Copy v-else class="h-4 w-4" />
          </Button>
        </div>
        <p class="text-[11px] text-muted-foreground mt-1">
          The iframe page auto-resizes on load by posting
          <code>groove:resize</code> via postMessage.
        </p>
      </div>

      <div class="flex justify-end">
        <Button variant="secondary" @click="$emit('update:open', false)">Close</Button>
      </div>
    </div>
  </Dialog>
</template>
