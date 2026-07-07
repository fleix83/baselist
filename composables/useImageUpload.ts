// Clientseitiges Verkleinern (Canvas) vor dem Upload zu R2.
const MAX_DIMENSION = 1600
const QUALITY = 0.85

async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1024 * 1024) {
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht verarbeitet werden'))),
      'image/webp',
      QUALITY,
    )
  })
}

export function useImageUpload() {
  async function upload(file: File): Promise<string> {
    const blob = await resizeImage(file)
    const form = new FormData()
    form.append('file', blob, 'bild.webp')
    const res = await $fetch<{ url: string }>('/api/uploads', { method: 'POST', body: form })
    return res.url
  }
  return { upload }
}
