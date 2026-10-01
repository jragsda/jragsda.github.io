import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js'
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js'

const config = window.__FIREBASE_CONFIG__

export const firebaseConfigured =
  !!config &&
  typeof config.apiKey === 'string' &&
  config.apiKey &&
  typeof config.projectId === 'string' &&
  config.projectId

const app = firebaseConfigured
  ? (getApps().length ? getApps()[0] : initializeApp(config))
  : null

export const auth = app ? getAuth(app) : null
export const firestore = app ? getFirestore(app) : null

export {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
}
