import ApplicationDetailPage from '../../jobseeker-applications-offers';
export default async function Page({params}){const {applicationId}=await params;return <ApplicationDetailPage page="application-detail" applicationId={applicationId}/>}
