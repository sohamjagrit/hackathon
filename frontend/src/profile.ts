export interface UserProfile {
  firstName: string
  lastName: string
  email: string
}

const PROFILE_KEY = 'miles_user_profile'

export function loadProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserProfile
    if (!parsed.firstName) return null
    return parsed
  } catch {
    return null
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function greetingForNow(firstName: string, date = new Date()): string {
  const hour = date.getHours()
  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${salutation}, ${firstName}.`
}
