'use client';
import {useParams} from 'next/navigation';
import MentorRollPage from '../../../MentorRollPage';
export default function MentorStartupOverviewPage(){const params=useParams<{mentorshipId:string}>();return <MentorRollPage section="startup" mentorshipId={params.mentorshipId}/>}
