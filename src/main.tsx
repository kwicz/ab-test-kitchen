import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { shouldRetry } from './lib/api';
import { PeekingProvider } from './lib/peeking';
import './styles/app.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: shouldRetry } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PeekingProvider>
        <App />
      </PeekingProvider>
    </QueryClientProvider>
  </StrictMode>,
);
