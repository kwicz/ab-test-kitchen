import { lazy, Suspense } from 'react';
import { Route, Switch } from 'wouter';
import { Layout } from './components/Layout';
import { Board } from './pages/Board';
import { Pantry } from './pages/Pantry';

// The detail page carries the charting library, so it loads on demand.
const TestDetail = lazy(() => import('./pages/TestDetail').then((m) => ({ default: m.TestDetail })));

export function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Board} />
        <Route path="/tests/:id">
          {(p) => (
            <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-wash" />}>
              <TestDetail id={Number(p.id)} />
            </Suspense>
          )}
        </Route>
        <Route path="/pantry" component={Pantry} />
        <Route>
          <div className="py-24 text-center">
            <p className="display text-3xl">Nothing on this shelf.</p>
          </div>
        </Route>
      </Switch>
    </Layout>
  );
}
