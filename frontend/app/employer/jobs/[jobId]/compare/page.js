import { CompareCandidatesPage } from '../../../employer-hiring';
export default async function Page({params}){const {jobId}=await params;return <CompareCandidatesPage page="jobs" jobId={jobId}/>}
