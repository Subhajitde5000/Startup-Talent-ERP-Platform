import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata = {
  title: 'Forma — Workspace',
  description: 'Startup and talent workspace',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
