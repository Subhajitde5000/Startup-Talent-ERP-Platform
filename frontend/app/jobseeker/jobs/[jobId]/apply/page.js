import ApplyPage from '../../../jobseeker-find-apply';
export default async function Page({params}){const {jobId}=await params;return <ApplyPage page="apply" jobId={jobId}/>}
