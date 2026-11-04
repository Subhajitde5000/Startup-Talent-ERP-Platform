'use client';
import {useParams} from 'next/navigation';
import MentorRollPage from '../../MentorRollPage';
export default function MentorWorkspacePage(){const params=useParams<{mentorshipId:string}>();return <MentorRollPage section="workspace" mentorshipId={params.mentorshipId}/>}
