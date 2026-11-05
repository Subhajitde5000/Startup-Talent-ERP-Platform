'use client';
import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
export type RequestState='Requested'|'Accepted'|'Declined'|'Withdrawn'|'Expired';
export type MentorshipState='Active'|'Paused'|'Completed';
export type SessionState='Scheduled'|'Confirmed'|'Completed'|'Cancelled'|'Reschedule requested';
export type ReadinessState='Not started'|'In progress'|'Submitted for sign-off'|'Signed off'|'Changes requested';
export interface MentorRequest {id:string;mentorId:string;mentorName:string;goal:string;needs:string[];cadence:string;duration:string;documents:string[];message:string;feeTerms:string;equityTerms:string;status:RequestState;createdAt:string;lastActivity:string;}
export interface Mentorship {id:string;mentorId:string;mentorName:string;status:MentorshipState;startedAt:string;cadence:string;duration:string;focusAreas:string[];goals:Array<{id:string;title:string;description:string;targetDate:string;successMeasure:string;owner:string;status:'To do'|'In progress'|'Done'}>;notes:string;}
export interface MentorSession {id:string;mentorshipId:string;mentorId:string;mentorName:string;topic:string;date:string;duration:number;status:SessionState;attendees:string[];agenda:string;notes:string;actions:string;rating:number|null;feedback:string;timezone:string;recordingConsent:boolean;paymentStatus:'Not connected'|'Paid'|'Pending'|'Free';}
export interface ReadinessItem {id:string;title:string;criteria:string;status:ReadinessState;owner:string;mentorName:string;note:string;evidence:string[];updatedAt?:string;}
export interface MentorData {requests:MentorRequest[];mentorships:Mentorship[];sessions:MentorSession[];readiness:ReadinessItem[];savedMentorIds:string[];}
const initialReadiness:ReadinessItem[]=[
{id:'pitch',title:'Pitch deck and one-page summary reviewed',criteria:'Current narrative, problem, solution and ask are clear and internally consistent.' ,status:'Not started',owner:'',mentorName:'',note:'',evidence:[]},
{id:'business-model',title:'Business model and unit economics validated',criteria:'Revenue model, costs and unit-economics assumptions have supporting evidence.',status:'Not started',owner:'',mentorName:'',note:'',evidence:[]},
{id:'financials',title:'Financial projections and use of funds defined',criteria:'Projection assumptions, funding need and use of funds are documented.',status:'Not started',owner:'',mentorName:'',note:'',evidence:[]},
{id:'cap-table',title:'Cap table and legal basics in order',criteria:'Ownership and core legal records are current and available for review.',status:'Not started',owner:'',mentorName:'',note:'',evidence:[]},
{id:'traction',title:'Traction metrics documented',criteria:'Relevant traction data is dated, sourced and clearly defined.',status:'Not started',owner:'',mentorName:'',note:'',evidence:[]},
{id:'data-room',title:'Data room complete',criteria:'Core company, product, market and financial documents are organized.',status:'Not started',owner:'',mentorName:'',note:'',evidence:[]},
];
const KEY='meridian-startup-mentor-workspace-v1';
const INITIAL:MentorData={requests:[],mentorships:[],sessions:[],readiness:initialReadiness,savedMentorIds:[]};
interface Value {data:MentorData;setData:React.Dispatch<React.SetStateAction<MentorData>>;hydrated:boolean;}
const Context=createContext<Value|null>(null);
export function MentorWorkspaceProvider({children}:{children:React.ReactNode}){const [data,setData]=useState(INITIAL);const [hydrated,setHydrated]=useState(false);useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw) as Partial<MentorData>;setData({...INITIAL,...saved,readiness:saved.readiness?.length?saved.readiness:initialReadiness});}}catch{/* keep an empty mentor workspace */}setHydrated(true);},[]);useEffect(()=>{if(hydrated){try{localStorage.setItem(KEY,JSON.stringify(data));}catch{/* best-effort local persistence */}}},[hydrated,data]);const value=useMemo(()=>({data,setData,hydrated}),[data,hydrated]);return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useMentorWorkspace(){const value=useContext(Context);if(!value)throw new Error('useMentorWorkspace must be within MentorWorkspaceProvider');return value;}
