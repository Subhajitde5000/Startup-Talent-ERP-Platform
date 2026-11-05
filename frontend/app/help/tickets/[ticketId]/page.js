import { HelpPage } from '../../../jobseeker/jobseeker-shared-pages';
export default async function Page({params}){const {ticketId}=await params;return <HelpPage page="help" ticketId={ticketId}/>}
