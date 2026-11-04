'use client';
import {useParams} from 'next/navigation';
import MentorRollPage from '../../MentorRollPage';
export default function MentorAgreementDetailPage(){const {agreementId}=useParams<{agreementId:string}>();return <MentorRollPage section="agreement-detail" agreementId={agreementId}/>}
