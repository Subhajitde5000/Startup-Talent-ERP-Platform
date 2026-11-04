'use client';
import {useParams} from 'next/navigation';
import InvestorRollPage from '../../InvestorRollPage';
export default function InvestorCommitmentDetailPage(){const {commitmentId}=useParams<{commitmentId:string}>();return <InvestorRollPage section="commitment-detail" commitmentId={commitmentId}/>}
