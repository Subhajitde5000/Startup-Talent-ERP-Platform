import LivePracticeSessionPage from '../../jobseeker-interview-trainer';
export default async function Page({params}){const {sessionId}=await params;return <LivePracticeSessionPage page="session" sessionId={sessionId}/>}
