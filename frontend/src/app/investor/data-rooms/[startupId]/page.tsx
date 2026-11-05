'use client';
import {useParams} from 'next/navigation';
import InvestorRollPage from '../../InvestorRollPage';
export default function InvestorDataRoomViewerPage(){const {startupId}=useParams<{startupId:string}>();return <InvestorRollPage section="data-room-viewer" startupId={startupId}/>}
