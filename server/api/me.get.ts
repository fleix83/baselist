import { getCurrentUser } from '../utils/auth'
import { uploadsEnabled } from '../utils/storage'

export default defineEventHandler(async (event) => {
  const current = await getCurrentUser(event)
  if (!current) {
    return { authUser: null, user: null, account: null, uploadsEnabled: uploadsEnabled() }
  }
  return {
    uploadsEnabled: uploadsEnabled(),
    authUser: {
      id: current.authUser.id,
      email: current.authUser.email,
      emailVerified: current.authUser.emailVerified ?? false,
    },
    user: current.user
      ? { isAdmin: current.user.isAdmin, interests: current.user.interests }
      : null,
    account: current.account,
  }
})
