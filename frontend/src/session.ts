/** Session ID ties voice session, LangGraph thread, and SSE stream together. */
function generateId(): string {
  return crypto.randomUUID()
}

const SESSION_KEY = 'miles_session_id'

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = generateId()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export function resetSession(): string {
  const id = generateId()
  sessionStorage.setItem(SESSION_KEY, id)
  return id
}
