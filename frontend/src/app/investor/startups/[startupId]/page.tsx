'use client';
import {useParams} from 'next/navigation';
import InvestorRollPage from '../../InvestorRollPage';
export default function InvestorStartupProfilePage(){const {startupId}=useParams<{startupId:string}>();return <InvestorRollPage section="startup-detail" startupId={startupId}/>}
