import InvestorApp from '../../investors/investor-app';export default async function Page({params}){const p=await params;return <InvestorApp page="round-detail" id={p.roundId}/>}
