import Hiring from '../../../hiring-app';export default async function Page({params}){const p=await params;return <Hiring page="candidate" jobId={p.jobId} applicantId={p.applicantId}/>}
