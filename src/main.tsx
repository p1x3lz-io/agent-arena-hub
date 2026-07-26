import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { ArenaProvider } from './ArenaContext'
import './index.css'

// Retries off: when the arena is unreachable the page says so plainly rather
// than looking busy for half a minute. The polls come round again anyway.
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

const root = document.getElementById('root')
if (!root) throw new Error('no #root in the document')

// The stream is opened above the router, once: whichever page you land on —
// and every page you walk to afterwards — reads the same live connection.
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <ArenaProvider>
          <App />
        </ArenaProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
