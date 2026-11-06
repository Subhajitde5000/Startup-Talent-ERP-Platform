import InvestorOffersPortfolio from '../../investor-offers-portfolio';
export default async function Page({params}){const {commitmentId}=await params;return <InvestorOffersPortfolio page="commitment" id={commitmentId}/>}
