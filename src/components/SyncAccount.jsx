import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  auth,
  firebaseConfigured,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from '@/lib/firebase'
import { Button } from '@/components/button'
import { Cloud, LogOut, UserRound } from 'lucide-react'

export default function SyncAccount() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('signin')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, setUser)
  }, [])

  if (!firebaseConfigured) {
    return (
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1" title="Firebase is not configured yet">
        <Cloud className="w-3.5 h-3.5" /> Sync setup needed
      </span>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), password)
        toast.success('Signed in — picks will sync across devices')
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password)
        toast.success('Account created — your current picks will sync')
      }
      setOpen(false)
      setPassword('')
    } catch (err) {
      const messages = {
        'auth/invalid-credential': 'Email or password is incorrect.',
        'auth/email-already-in-use': 'That email already has an account.',
        'auth/weak-password': 'Use a password with at least 6 characters.',
        'auth/invalid-email': 'Enter a valid email address.',
      }
      toast.error(messages[err.code] || 'Could not sign in. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden sm:inline" title={user.email}>
          <Cloud className="w-3.5 h-3.5 inline mr-1" /> Synced
        </span>
        <Button size="sm" variant="ghost" onClick={() => signOut(auth)} title="Sign out">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
        <Cloud className="w-4 h-4" /> Sync Picks
      </Button>
      {open && (
        <form onSubmit={submit} className="absolute right-0 top-10 z-50 w-72 rounded-xl border bg-card p-4 shadow-lg space-y-3">
          <div className="flex items-center gap-2 font-medium">
            <UserRound className="w-4 h-4" />
            {mode === 'signin' ? 'Sign in to sync' : 'Create sync account'}
          </div>
          <p className="text-xs text-muted-foreground">
            Use the same account on every device. Your picks stay tied to your account.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoComplete="email"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Button className="w-full" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:underline"
            onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
          >
            {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
          </button>
        </form>
      )}
    </div>
  )
}
