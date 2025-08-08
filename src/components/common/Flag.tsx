// src/components/common/Flag.tsx
// Create a new folder 'common' inside 'components' for this file.

import React from 'react';
import { GB } from 'country-flag-icons/react/3x2';

// Dynamically import all flags for tree-shaking
const flags = import.meta.glob('/node_modules/country-flag-icons/react/3x2/*.tsx', { eager: true });

interface FlagProps {
  code: string;
  className?: string;
}

// Helper to get the correct flag component from the dynamic import
const getFlagComponent = (code: string) => {
  const path = `/node_modules/country-flag-icons/react/3x2/${code.toUpperCase()}.tsx`;
  return flags[path] as { default: React.ComponentType<any> } | undefined;
};

const Flag = ({ code, className = 'w-6 h-auto inline-block' }: FlagProps) => {
  let FlagComponent;

  // Handle custom codes for UK nations
  if (code.startsWith('GB-')) {
    FlagComponent = GB;
  } else {
    const flagModule = getFlagComponent(code);
    FlagComponent = flagModule ? flagModule.default : null;
  }

  if (!FlagComponent) {
    // Fallback for codes without a specific flag (like Antarctica)
    return <span className={className}>🏳️</span>;
  }

  return <FlagComponent title={code} className={className} />;
};

export default Flag;
