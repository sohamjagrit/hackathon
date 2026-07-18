import { useState } from 'react'
import type { UserProfile } from '../profile'

interface SignupPageProps {
  onComplete: (profile: UserProfile) => void
}

export function SignupPage({ onComplete }: SignupPageProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!firstName.trim()) {
      setError('Please enter your first name.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    onComplete({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
    })
  }

  return (
    <div className="prototype-page signup-page">
      <form className="signup-card" onSubmit={handleSubmit}>
        <p className="eyebrow">Miles</p>
        <h1 className="signup-title">Travel, handled by voice.</h1>
        <p className="signup-sub">Tell us who you are so Miles can greet you and send itineraries.</p>

        <label className="signup-label" htmlFor="signup-first">First name</label>
        <input
          id="signup-first"
          className="signup-input"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          placeholder="Soham"
          autoFocus
        />

        <label className="signup-label" htmlFor="signup-last">Last name</label>
        <input
          id="signup-last"
          className="signup-input"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          placeholder="Jagrit"
        />

        <label className="signup-label" htmlFor="signup-email">Email address</label>
        <input
          id="signup-email"
          className="signup-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />

        {error && <p className="signup-error">{error}</p>}

        <button type="submit" className="signup-submit">Enter</button>
      </form>
    </div>
  )
}
