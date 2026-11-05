import OfferDetailPage from '../../jobseeker-applications-offers';
export default async function Page({params}){const {offerId}=await params;return <OfferDetailPage page="offer-detail" offerId={offerId}/>}
