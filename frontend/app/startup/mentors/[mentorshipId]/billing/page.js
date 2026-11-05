import MentorApp from '../../mentor-app';export default async function Page({params}){const p=await params;return <MentorApp page="billing" id={p.mentorshipId}/>}
