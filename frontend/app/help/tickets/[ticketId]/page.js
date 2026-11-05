import InvestorShared from '../../../investor/investor-shared';
export default async function Page({params}){const {ticketId}=await params;return <InvestorShared page="help" ticketId={ticketId}/>}
