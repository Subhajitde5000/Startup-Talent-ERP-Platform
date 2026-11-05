'use client';
import {useParams} from 'next/navigation';
import MentorRollPage from '../MentorRollPage';
export default function MentorSectionPage(){const params=useParams<{section:string}>();return <MentorRollPage section={params.section}/>}
