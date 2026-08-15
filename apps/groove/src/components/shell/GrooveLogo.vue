<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: number | string
    variant?: 'full' | 'mono'
    ariaLabel?: string
  }>(),
  { width: 160, variant: 'full', ariaLabel: 'groove logotipo' },
)
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 849.6 329.92"
    role="img"
    :aria-label="ariaLabel"
    :width="width"
    class="groove-wordmark"
  >
    <title>{{ variant === 'mono' ? 'g' : 'groove' }}</title>
    <text
      transform="translate(5.52 250.66)"
      fill="currentColor"
      font-family="'Didact Gothic', 'Oferta do Dia', 'Inter', sans-serif"
      font-size="296.85"
      font-weight="400"
    >
      {{ variant === 'mono' ? 'g' : 'groove' }}
    </text>
    <polygon points="60.34 198.02 84.8 150.91 107.45 198.02 60.34 198.02" fill="currentColor" />
  </svg>
</template>

<style scoped>
.groove-wordmark {
  display: block;
  width: auto;
  max-width: 100%;
  color: inherit;
}
</style>
