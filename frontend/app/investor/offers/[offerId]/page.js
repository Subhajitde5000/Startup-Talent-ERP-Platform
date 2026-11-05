import InvestorOffersPortfolio from '../../investor-offers-portfolio';
export default async function Page({params}){const {offerId}=await params;return <InvestorOffersPortfolio page="offer" id={offerId}/>}
