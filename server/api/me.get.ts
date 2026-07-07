import { getCurrentUser } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const current = await getCurrentUser(event)
  if (!current) {
    return { authUser: null, user: null, account: null }
  }
  return {
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
