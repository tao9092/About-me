import{ProjectsLab}from"@/components/projects-lab";
// Static; a search (?q=) is rewritten to /search/projects (next.config.ts).
export const revalidate=60;
export default function Page(){return <ProjectsLab/>}
