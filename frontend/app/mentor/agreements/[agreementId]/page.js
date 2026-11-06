import MentorMoney from '../../mentor-money';export default async function Page({params}){const p=await params;return <MentorMoney page="agreement" id={p.agreementId}/>}
