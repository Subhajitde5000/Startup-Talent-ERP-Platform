'use client';
import {useParams} from 'next/navigation';
import InvestorRollPage from '../../InvestorRollPage';
export default function InvestorPortfolioCompanyPage(){const {startupId}=useParams<{startupId:string}>();return <InvestorRollPage section="portfolio-company" startupId={startupId}/>}
