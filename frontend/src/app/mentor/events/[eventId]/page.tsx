'use client';
import {useParams} from 'next/navigation';
import MentorRollPage from '../../MentorRollPage';
export default function MentorEventDetailPage(){const {eventId}=useParams<{eventId:string}>();return <MentorRollPage section="event-detail" eventId={eventId}/>}
