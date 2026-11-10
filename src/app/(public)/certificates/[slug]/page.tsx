import type{Metadata}from"next";import{CertificateRecord}from"@/components/certificate-record";import{getPublicContent,listContent}from"@/lib/content";
// Every published record is prerendered; a new one renders on its first visit
// and is cached from then on (refreshed like the list pages).
export const revalidate=60;
export async function generateStaticParams(){return (await listContent("certificates",{limit:500})).map(row=>({slug:String(row.slug)}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;const row=await getPublicContent("certificates",slug);if(!row)return{title:"Certificate not found",robots:{index:false,follow:false}};return{title:String(row.title_en),description:String(row.summary_en??"")}}export default async function Page({params}:{params:Promise<{slug:string}>}){return <CertificateRecord slug={(await params).slug}/>}
