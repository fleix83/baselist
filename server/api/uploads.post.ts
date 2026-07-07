import { requireUser } from '../utils/auth'
import { uploadImage, uploadsEnabled } from '../utils/storage'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_BYTES = 5 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const { account } = await requireUser(event)
  if (!uploadsEnabled()) {
    throw createError({ statusCode: 503, statusMessage: 'Bildupload ist noch nicht konfiguriert (R2-Zugangsdaten fehlen).' })
  }
  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.data?.length)
  if (!file || !file.type || !(file.type in ALLOWED_TYPES)) {
    throw createError({ statusCode: 400, statusMessage: 'Bitte ein Bild (JPEG, PNG oder WebP) hochladen.' })
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Bild zu gross (max. 5 MB).' })
  }
  const key = `media/${account.id}/${crypto.randomUUID()}.${ALLOWED_TYPES[file.type]}`
  const url = await uploadImage(key, file.data as Buffer, file.type)
  return { url }
})
