import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../../src/context/AppContext';
import { AuthProvider } from '../../src/context/AuthContext';
import { DataProvider } from '../../src/context/DataContext';

interface RenderRouteOptions {
  path: string;
  route: string;
}

export function renderWithProviders(ui: ReactElement, options: RenderRouteOptions) {
  const { path, route } = options;

  return render(
    <AppProvider>
      <AuthProvider>
        <DataProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={ui} />
            </Routes>
          </MemoryRouter>
        </DataProvider>
      </AuthProvider>
    </AppProvider>,
  );
}
