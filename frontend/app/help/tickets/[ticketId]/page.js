import MentorShared from '../../../mentor/mentor-shared';
export default async function Page({params}){const {ticketId}=await params;return <MentorShared page="help" ticketId={ticketId}/>}
