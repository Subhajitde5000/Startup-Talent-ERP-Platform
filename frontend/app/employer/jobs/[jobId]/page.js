import { JobDetailPipelinePage } from '../../employer-hiring';
export default async function Page({params}){const {jobId}=await params;return <JobDetailPipelinePage page="jobs" jobId={jobId}/>}
