'use client';
import {useParams} from 'next/navigation';
import MentorRollPage from '../../../MentorRollPage';
export default function ReadinessSignoffPage(){const p=useParams<{mentorshipId:string}>();return <MentorRollPage section="readiness" mentorshipId={p.mentorshipId}/>;}
