import MentorApp from '../../mentor-app';export default async function Page({params}){const p=await params;return <MentorApp page="mentor-profile" id={p.mentorId}/>}
