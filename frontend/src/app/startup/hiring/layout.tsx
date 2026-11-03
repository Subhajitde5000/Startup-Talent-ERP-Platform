import React from 'react';
import { HiringWorkspaceProvider } from '@/context/HiringWorkspaceContext';

export default function HiringLayout({children}:{children:React.ReactNode}){
  return <HiringWorkspaceProvider>{children}</HiringWorkspaceProvider>;
}
