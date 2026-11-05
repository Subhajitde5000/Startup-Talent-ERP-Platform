import MentorApp from '../../mentors/mentor-app';export default async function Page({params}){const p=await params;return <MentorApp page="session" id={p.sessionId}/>}
