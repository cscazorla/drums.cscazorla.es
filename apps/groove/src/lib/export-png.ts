export async function exportPng(svg: SVGSVGElement, filename = 'groove') {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const vb = clone.viewBox?.baseVal
  const width =
    vb?.width || Number(clone.getAttribute('width')) || svg.getBoundingClientRect().width
  const height =
    vb?.height || Number(clone.getAttribute('height')) || svg.getBoundingClientRect().height
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const serializer = new XMLSerializer()
  const source = serializer.serializeToString(clone)
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('svg→img failed'))
    img.src = url
  })

  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0)

  canvas.toBlob((pngBlob) => {
    if (!pngBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(pngBlob)
    a.download = `${filename.replace(/\s+/g, '_')}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }, 'image/png')

  URL.revokeObjectURL(url)
}
