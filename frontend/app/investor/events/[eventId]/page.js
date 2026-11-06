import InvestorMembership from '../../investor-membership';
export default async function Page({params}){const {eventId}=await params;return <InvestorMembership page="event" eventId={eventId}/>}
