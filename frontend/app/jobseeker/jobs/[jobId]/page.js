import JobDetailPage from '../../jobseeker-find-apply';
export default async function Page({params}){const {jobId}=await params;return <JobDetailPage page="job-detail" jobId={jobId}/>}
