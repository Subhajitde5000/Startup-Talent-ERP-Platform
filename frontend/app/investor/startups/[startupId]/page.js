import InvestorDealflow from '../../investor-dealflow';
export default async function Page({params}){const {startupId}=await params;return <InvestorDealflow page="profile" startupId={startupId}/>}
