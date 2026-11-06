import ResumeEditorPage from '../../jobseeker-resume-maker';
export default async function Page({params}){const {resumeId}=await params;return <ResumeEditorPage page="editor" resumeId={resumeId}/>}
