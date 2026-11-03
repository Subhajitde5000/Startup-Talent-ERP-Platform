'use client';
import {useParams} from 'next/navigation';
import MentorPages from '../../MentorPages';
export default function Page(){const params=useParams<{mentorId:string}>();return <MentorPages view="profile" mentorId={params.mentorId}/>;}
