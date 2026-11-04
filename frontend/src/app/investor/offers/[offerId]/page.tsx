'use client';
import {useParams} from 'next/navigation';
import InvestorRollPage from '../../InvestorRollPage';
export default function InvestorOfferDetailPage(){const {offerId}=useParams<{offerId:string}>();return <InvestorRollPage section="offer-detail" offerId={offerId}/>}
