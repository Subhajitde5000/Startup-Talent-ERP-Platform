import MentorMoney from '../../mentor-money';export default async function Page({params}){const p=await params;return <MentorMoney page="event" id={p.eventId}/>}
