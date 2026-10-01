const config = window.__FIREBASE_CONFIG__ || {}

export const firebaseConfigured =
  !!window.firebase &&
  !!config.apiKey &&
  config.apiKey !== 'REPLACE_ME' &&
  !!config.projectId &&
  config.projectId !== 'REPLACE_ME'

let app = null
let auth = null
let firestore = null

if (firebaseConfigured) {
  app = window.firebase.initializeApp(config)
  auth = window.firebase.auth(app)
  firestore = window.firebase.firestore(app)
}

export { auth, firestore }
