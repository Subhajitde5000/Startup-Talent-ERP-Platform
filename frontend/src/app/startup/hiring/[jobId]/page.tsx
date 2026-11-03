'use client';
import {useParams} from 'next/navigation';
import HiringWorkspacePage from '../HiringWorkspace';
export default function Page(){const params=useParams<{jobId:string}>();return <HiringWorkspacePage view="job-detail" jobId={params.jobId}/>;}
