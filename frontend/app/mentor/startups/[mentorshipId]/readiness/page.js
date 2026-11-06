import MentorSessions from '../../../mentor-sessions';export default async function Page({params}){const p=await params;return <MentorSessions page="readiness" id={p.mentorshipId}/>}
