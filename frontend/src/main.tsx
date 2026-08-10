import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { FeedbackProvider } from './components/FeedbackProvider'
import { AccessibilityBridge } from './components/AccessibilityBridge'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeedbackProvider>
      <AccessibilityBridge />
      <App />
    </FeedbackProvider>
  </StrictMode>,
)
