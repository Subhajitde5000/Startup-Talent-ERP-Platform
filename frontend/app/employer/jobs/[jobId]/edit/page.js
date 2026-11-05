import { JobEditorPage } from '../../../employer-hiring';
export default async function Page({params}){const {jobId}=await params;return <JobEditorPage page="jobs" jobId={jobId} editMode={true}/>}
