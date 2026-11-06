import JobTailoringPage from '../../../jobseeker-resume-maker';
export default async function Page({params}){const {resumeId}=await params;return <JobTailoringPage page="tailor" resumeId={resumeId}/>}
