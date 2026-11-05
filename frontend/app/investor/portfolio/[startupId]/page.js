import InvestorOffersPortfolio from '../../investor-offers-portfolio';
export default async function Page({params}){const {startupId}=await params;return <InvestorOffersPortfolio page="company" startupId={startupId}/>}
