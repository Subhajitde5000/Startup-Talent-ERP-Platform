import { CandidateProfilePage } from '../../../../employer-hiring';
export default async function Page({params}){const {jobId,applicantId}=await params;return <CandidateProfilePage page="jobs" jobId={jobId} applicantId={applicantId}/>}
