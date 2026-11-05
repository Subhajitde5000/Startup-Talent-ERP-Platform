import MentorCore from '../../../mentor-core';export default async function Page({params}){const p=await params;return <MentorCore page="startup" id={p.mentorshipId}/>}
