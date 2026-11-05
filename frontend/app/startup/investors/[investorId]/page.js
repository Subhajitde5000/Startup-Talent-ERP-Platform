import InvestorApp from '../investor-app';export default async function Page({params}){const p=await params;return <InvestorApp page="investor" id={p.investorId}/>}
