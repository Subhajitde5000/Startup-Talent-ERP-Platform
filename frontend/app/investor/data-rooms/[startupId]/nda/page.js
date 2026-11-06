import InvestorDiligence from '../../../investor-diligence';
export default async function Page({params}){const {startupId}=await params;return <InvestorDiligence page="nda" startupId={startupId}/>}
