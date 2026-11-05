'use client';
import {useParams} from 'next/navigation';
import InvestorRollPage from '../../InvestorRollPage';
export default function InvestorEventDetailPage(){const {eventId}=useParams<{eventId:string}>();return <InvestorRollPage section="event-detail" eventId={eventId}/>}
