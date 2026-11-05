import React from 'react';
import {MentorRoleProvider} from '@/context/MentorRoleContext';
import MentorShell from '@/components/mentor/MentorShell';
export default function MentorLayout({children}:{children:React.ReactNode}){return <MentorRoleProvider><MentorShell>{children}</MentorShell></MentorRoleProvider>}
