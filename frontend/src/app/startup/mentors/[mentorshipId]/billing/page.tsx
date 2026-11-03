'use client';
import {useParams} from 'next/navigation';
import MentorPages from '../../MentorPages';
export default function Page(){const params=useParams<{mentorshipId:string}>();return <MentorPages view="billing" mentorshipId={params.mentorshipId}/>;}
