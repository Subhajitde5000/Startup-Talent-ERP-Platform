'use client';
import React,{useEffect,useState} from 'react';
import MentorSharedPreviewFrame from '@/components/mentor/MentorSharedPreviewFrame';
import {MentorHelpPage,MentorNotificationsPage,MentorTicketsPage} from '@/components/mentor/MentorSharedPages';
import InvestorSharedPreviewFrame from '@/components/investor/InvestorSharedPreviewFrame';
import {InvestorHelpPage,InvestorNotificationsPage,InvestorTicketsPage} from '@/components/investor/InvestorSharedPages';
type SharedPage='notifications'|'help'|'tickets';
export default function RoleAwareSharedPreview({page}:{page:SharedPage}){const [role,setRole]=useState<'checking'|'investor'|'mentor'>('checking');useEffect(()=>{setRole(new URLSearchParams(window.location.search).get('role')==='investor'?'investor':'mentor')},[]);if(role==='checking')return <div role="status" style={{padding:24,color:'#4a5568'}}>Loading the active role's shared page…</div>;if(role==='investor')return <InvestorSharedPreviewFrame>{page==='notifications'?<InvestorNotificationsPage/>:page==='help'?<InvestorHelpPage/>:<InvestorTicketsPage/>}</InvestorSharedPreviewFrame>;return <MentorSharedPreviewFrame>{page==='notifications'?<MentorNotificationsPage/>:page==='help'?<MentorHelpPage/>:<MentorTicketsPage/>}</MentorSharedPreviewFrame>}
