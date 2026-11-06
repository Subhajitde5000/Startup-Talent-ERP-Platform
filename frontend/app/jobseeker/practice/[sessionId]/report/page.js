import FeedbackReportPage from '../../../jobseeker-interview-trainer';
export default async function Page({params}){const {sessionId}=await params;return <FeedbackReportPage page="report" sessionId={sessionId}/>}
