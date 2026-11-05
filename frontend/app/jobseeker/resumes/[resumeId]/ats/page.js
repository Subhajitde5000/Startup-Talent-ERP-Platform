import AtsCheckPage from '../../../jobseeker-resume-maker';
export default async function Page({params}){const {resumeId}=await params;return <AtsCheckPage page="ats" resumeId={resumeId}/>}
