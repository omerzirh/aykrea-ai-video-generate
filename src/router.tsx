import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import UserDashboard from './components/subscription/UserDashboard';
import SubscriptionPlans from './components/subscription/SubscriptionPlans';
import CheckoutSuccess from './components/subscription/CheckoutSuccess';
import CheckoutCanceled from './components/subscription/CheckoutCanceled';
import Layout from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { GeneratedContent } from './components/GeneratedContent';



// Router configuration
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <App />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <UserDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'plans',
        element: <SubscriptionPlans />,
      },
      {
        path: 'success',
        element: <CheckoutSuccess />,
      },
      {
        path: 'canceled',
        element: <CheckoutCanceled />,
      },
      {
        path: 'my-content',
        element: (
          <ProtectedRoute>
            <GeneratedContent />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
