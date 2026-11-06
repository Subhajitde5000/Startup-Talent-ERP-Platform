import CompanyPage from '../../jobseeker-find-apply';
export default async function Page({params}){const {companyId}=await params;return <CompanyPage page="company" companyId={companyId}/>}
