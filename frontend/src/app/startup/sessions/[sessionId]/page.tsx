'use client';
import {useParams} from 'next/navigation';
import MentorPages from '../../mentors/MentorPages';
export default function Page(){const params=useParams<{sessionId:string}>();return <MentorPages view="session" sessionId={params.sessionId}/>;}
