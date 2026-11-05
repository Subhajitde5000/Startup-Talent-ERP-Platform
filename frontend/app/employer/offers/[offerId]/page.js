import { OfferDetailPage } from '../../employer-hiring';
export default async function Page({params}){const {offerId}=await params;return <OfferDetailPage page="offers" offerId={offerId}/>}
