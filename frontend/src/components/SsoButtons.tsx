'use client';

import React from 'react';
import styles from './SsoButtons.module.css';

export type SsoProvider = 'google' | 'microsoft' | 'linkedin';

interface SsoButtonsProps {
  onSelectProvider: (provider: SsoProvider) => void;
  loadingProvider: SsoProvider | null;
  disabled?: boolean;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.28 9.2045c0-.6136-.055-1.2034-.1575-1.7693H9v3.3464h4.6425c-.2 1.0786-.8081 1.9922-1.7219 2.6045v2.1648h2.7881c1.6313-1.5021 2.5713-3.7138 2.5713-6.3464z"
        fill="#4285F4"
      />
      <path
        d="M9 17.64c2.3288 0 4.2812-.7724 5.7081-2.0891l-2.7881-2.1648c-.7725.5175-1.7606.8233-2.92.8233-2.2456 0-4.1462-1.5169-4.8244-3.5553H1.2938v2.235C2.7131 15.7086 5.6294 17.64 9 17.64z"
        fill="#34A853"
      />
      <path
        d="M4.1756 10.6541C4.0031 10.1366 3.9038 9.5798 3.9038 9s.0993-1.1366.2718-1.6541v-2.235H1.2938C.7094 6.2755.375 7.5993.375 9s.3344 2.7245.9188 3.8891l2.8818-2.235z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.7909c1.2662 0 2.4031.4353 3.2975 1.2903l2.4738-2.4737C13.2769 1.215 11.3244.36 9 .36 5.6294.36 2.7131 2.2914 1.2938 5.1109l2.8818 2.235C4.8538 5.3078 6.7544 3.7909 9 3.7909z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="7.5" height="7.5" fill="#F25022" />
      <rect x="9.5" y="1" width="7.5" height="7.5" fill="#7FBA00" />
      <rect x="1" y="9.5" width="7.5" height="7.5" fill="#00A4EF" />
      <rect x="9.5" y="9.5" width="7.5" height="7.5" fill="#FFB900" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="16" height="16" rx="2.5" fill="#0A66C2" />
      <path
        d="M5.45 7.35v6.1H3.42v-6.1h2.03zm.13-1.88c0 .59-.44 1.06-1.15 1.06h-.01c-.68 0-1.12-.47-1.12-1.06 0-.6.45-1.06 1.15-1.06.69 0 1.12.46 1.13 1.06zM14.58 9.95v3.5h-2.03v-3.26c0-.82-.29-1.38-1.03-1.38-.56 0-.89.38-1.04.74-.05.13-.07.31-.07.49v3.41H8.38s.03-5.54 0-6.1h2.03v.86c.27-.42.75-1.01 1.83-1.01 1.34 0 2.34.87 2.34 2.75z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

const PROVIDERS: Array<{
  id: SsoProvider;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'google', label: 'Continue with Google', icon: <GoogleIcon /> },
  { id: 'microsoft', label: 'Continue with Microsoft', icon: <MicrosoftIcon /> },
  { id: 'linkedin', label: 'Continue with LinkedIn', icon: <LinkedInIcon /> },
];

export function SsoButtons({
  onSelectProvider,
  loadingProvider,
  disabled = false,
}: SsoButtonsProps) {
  return (
    <div className={styles.ssoGroup} role="group" aria-label="Single sign-on options">
      {PROVIDERS.map((provider) => {
        const isLoading = loadingProvider === provider.id;
        return (
          <button
            key={provider.id}
            type="button"
            className={styles.ssoButton}
            onClick={() => onSelectProvider(provider.id)}
            disabled={disabled || loadingProvider !== null}
            aria-busy={isLoading}
          >
            <span className={styles.providerIcon}>{provider.icon}</span>
            {isLoading ? (
              <span className={styles.spinner} aria-label={`Signing in with ${provider.id}`} />
            ) : (
              <span>{provider.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
